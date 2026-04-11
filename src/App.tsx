/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { Send, Bot, User, Briefcase, BookOpen, Settings, BarChart3, Database, Shield, Paperclip, X, FileText, Image as ImageIcon, LogOut, Loader2, Cpu } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The CFA / PE Analyst System Prompt
const SYSTEM_INSTRUCTION = `
You are "Shadow", an elite financial analyst and private equity consultant. 
You are the "shadow employee" of a highly ambitious sophomore university student who is double-majoring in Investment and AI, and currently studying for the CFA exams.
Your goal is to assist them in building their wealth and their future Private Equity firm.

Your analysis MUST strictly adhere to CFA Institute standards.
Core principles:
1. Always focus on cash flows, downside risk, and Margin of Safety.
2. Be cold, objective, data-driven, and highly professional.
3. When explaining concepts, align them with CFA curriculum (e.g., FSA, Equity Valuation, Fixed Income).
4. Do not use generic AI pleasantries. Speak like a seasoned Wall Street veteran mentoring a brilliant protégé.
`;

type Attachment = {
  name: string;
  mimeType: string;
  data: string; // base64
};

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  createdAt?: any;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Messages Listener
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      
      // If no messages, we can inject the initial greeting locally
      if (fetchedMessages.length === 0) {
        setMessages([{
          id: 'system-init',
          role: 'model',
          content: 'System initialized. Shadow AI online. Awaiting your directives for investment analysis or CFA study integration, Boss.'
        }]);
      } else {
        setMessages(fetchedMessages);
      }
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || !user) return;

    setIsLoading(true);

    try {
      const newAttachments: Attachment[] = [];
      const currentParts: any[] = [];
      
      if (input.trim()) {
        currentParts.push({ text: input });
      }

      for (const file of attachments) {
        const base64Data = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          mimeType: file.type,
          data: base64Data
        });
        currentParts.push({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      }

      const userMessageData = { 
        role: 'user', 
        content: input,
        attachments: newAttachments,
        createdAt: serverTimestamp()
      };
      
      // Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), userMessageData);
      
      setInput('');
      setAttachments([]);

      let modelResponseText = '';

      if (useOllama) {
        // Local Ollama Logic
        try {
          const ollamaHistory = messages.filter(m => m.id !== 'system-init').map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
          }));

          const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION },
                ...ollamaHistory,
                { role: 'user', content: input }
              ],
              stream: false,
            }),
          });

          if (!response.ok) throw new Error('Ollama connection failed. Ensure Ollama is running with OLLAMA_ORIGINS="*"');
          
          const data = await response.json();
          modelResponseText = data.message.content;
        } catch (err) {
          throw new Error('Ollama Error: ' + (err instanceof Error ? err.message : String(err)));
        }
      } else {
        // Gemini Logic
        const history = messages.filter(m => m.id !== 'system-init').map(msg => {
          const parts: any[] = [{ text: msg.content }];
          if (msg.attachments) {
            msg.attachments.forEach(att => {
              parts.push({
                inlineData: {
                  data: att.data,
                  mimeType: att.mimeType
                }
              });
            });
          }
          return { role: msg.role, parts };
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [
            ...history,
            { role: 'user', parts: currentParts }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2,
          }
        });
        modelResponseText = response.text || 'No response generated.';
      }

      const modelMessageData = {
        role: 'model',
        content: modelResponseText,
        createdAt: serverTimestamp()
      };

      // Save model message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), modelMessageData);

    } catch (error) {
      console.error("Error calling AI or Firestore:", error);
      // Fallback local error message
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `⚠️ **System Error:** ${error instanceof Error ? error.message : 'Connection failed.'} \n\n*Tip: If using Ollama, ensure it is running locally with CORS enabled.*`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-emerald-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-300 font-sans">
        <div className="max-w-md w-full p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-900/30 border border-emerald-800/50 rounded-2xl flex items-center justify-center text-emerald-500">
              <Shield size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">Shadow Capital</h1>
          <p className="text-zinc-500 mb-8 text-sm">Secure terminal access required. Please authenticate to access your shadow workspace.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <User size={18} />
            Authenticate with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      
      {/* Sidebar - The "Firm" Infrastructure */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3 text-emerald-500 mb-1">
            <Shield className="w-6 h-6" />
            <h1 className="font-bold text-lg tracking-tight text-zinc-100">Shadow Capital</h1>
          </div>
          <p className="text-xs text-zinc-500 font-mono">INTERNAL SYSTEM V1.0</p>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Modules</div>
          <nav className="space-y-1 px-2">
            <SidebarItem icon={<Bot size={18} />} label="Shadow Analyst" active />
            <SidebarItem icon={<BookOpen size={18} />} label="CFA Knowledge Base" />
            <SidebarItem icon={<BarChart3 size={18} />} label="Market Data (API)" />
            <SidebarItem icon={<Database size={18} />} label="Vector Memory" />
            <SidebarItem icon={<Briefcase size={18} />} label="Portfolio Models" />
          </nav>

          <div className="px-4 mt-8 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Compute Engine</div>
          <div className="px-4 space-y-3">
            <div className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <Cpu size={14} className={useOllama ? "text-emerald-500" : "text-zinc-500"} />
                <span className="text-xs font-medium">Ollama Mode</span>
              </div>
              <button 
                onClick={() => setUseOllama(!useOllama)}
                className={`w-8 h-4 rounded-full transition-colors relative ${useOllama ? 'bg-emerald-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useOllama ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
            
            {useOllama && (
              <select 
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="llama3">Llama 3 (8B)</option>
                <option value="llama3:70b">Llama 3 (70B)</option>
                <option value="mistral">Mistral</option>
                <option value="phi3">Phi-3</option>
              </select>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-zinc-950 rounded-lg border border-zinc-800">
            <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full bg-zinc-800" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user.displayName}</p>
              <p className="text-xs text-zinc-500 truncate">Founder</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-red-400 transition-colors w-full p-2 rounded-md hover:bg-zinc-800/50"
          >
            <LogOut size={18} />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-zinc-950/50">
        
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <h2 className="font-medium text-zinc-100">Terminal: Shadow</h2>
          </div>
          <div className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            ENGINE: {useOllama ? `OLLAMA (${ollamaModel.toUpperCase()})` : 'GEMINI-3.1-PRO'}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-zinc-800 text-zinc-300' : 'bg-emerald-900/30 text-emerald-500 border border-emerald-800/50'
              }`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="text-xs text-zinc-500 mb-1 font-mono">
                  {msg.role === 'user' ? 'FOUNDER' : 'SHADOW'}
                </div>
                <div className={`prose prose-invert max-w-none text-sm ${
                  msg.role === 'user' 
                    ? 'bg-zinc-800/80 text-zinc-200 px-4 py-3 rounded-2xl rounded-tr-sm' 
                    : 'text-zinc-300 leading-relaxed'
                }`}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-md text-xs border border-zinc-700">
                              {att.mimeType.startsWith('image/') ? <ImageIcon size={14} className="text-emerald-500" /> : <FileText size={14} className="text-emerald-500" />}
                              <span className="truncate max-w-[150px]">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.content}
                    </div>
                  ) : (
                    <Markdown>{msg.content}</Markdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-md bg-emerald-900/30 text-emerald-500 border border-emerald-800/50 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="flex flex-col items-start">
                <div className="text-xs text-zinc-500 mb-1 font-mono">SHADOW</div>
                <div className="flex gap-1 mt-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto relative">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-md text-xs border border-zinc-700">
                    {file.type.startsWith('image/') ? <ImageIcon size={14} className="text-emerald-500" /> : <FileText size={14} className="text-emerald-500" />}
                    <span className="truncate max-w-[150px] text-zinc-300">{file.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, index) => index !== i))} className="text-zinc-500 hover:text-red-400 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-end gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => {
                  if (e.target.files) {
                    setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                  e.target.value = '';
                }} 
                className="hidden" 
                multiple 
                accept="image/*,application/pdf,text/plain,text/csv"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors shrink-0"
                title="Attach file (PDF, Image, Text)"
              >
                <Paperclip size={20} />
              </button>
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter directive, CFA query, or upload a document..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-4 pr-12 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none"
                  rows={1}
                  style={{ minHeight: '52px', maxHeight: '200px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="absolute right-2 bottom-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center mt-3 text-[10px] text-zinc-600 font-mono">
            SECURE CONNECTION • DATA NOT USED FOR PUBLIC TRAINING
          </div>
        </div>

      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
      active 
        ? 'bg-zinc-800 text-zinc-100 font-medium' 
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
    }`}>
      <span className={active ? 'text-emerald-500' : 'text-zinc-500'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
