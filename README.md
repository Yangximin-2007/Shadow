<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0a2373ed-ffd8-48c8-ab9f-45e0c40dd96f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


# 📈 影子分析师 (Shadow Analyst) - 基于 RAG 与本地大语言模型的金融投研助手

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Model](https://img.shields.io/badge/Model-Qwen-green)
![Tech](https://img.shields.io/badge/Tech-RAG%20%7C%20VectorDB-orange)

## 📝 项目简介
本项目是一个基于本地部署大语言模型（Qwen）和 RAG（检索增强生成）技术的金融投研 AI 助手。
区别于通用大模型，本项目针对金融领域的长文本（如公司招股书、年报、行业研报）进行了专门的流程优化，旨在辅助研究员快速提取核心财务数据、梳理医药行业研发管线进展，并生成结构化分析摘要。

## ⚙️ 核心技术架构
本项目采用离线本地计算，确保金融数据的绝对隐私安全。
1. **数据获取与清洗**：使用 Python 脚本爬取并清洗医药行业的公开财报与研报数据。
2. **知识库构建 (RAG)**：依托 AnythingLLM，将清洗后的非结构化文本进行切片（Chunking）并向量化（Embedding），存入本地向量数据库。
3. **大模型推理**：接入本地部署的通义千问 (Qwen) 开源模型。
4. **前端微终端**：自定义开发的轻量级交互界面，提供流畅的投研问答体验。

> **流程图：**
> 原始研报/财报 ➡️ 文本清洗与分块 ➡️ 向量数据库匹配检索 ➡️ 动态组装 Prompt ➡️ Qwen 模型推理 ➡️ 结构化研报输出

## 📸 效果展示
*(面试官重点看这里：展示 AI 根据财报准确回答问题的截图)*

[在这里放一张你的终端界面，或者 AnythingLLM 的问答截图]
> **图 1：** 提问“总结某医药公司最新季度的核心管线研发进展”，AI 基于外挂研报给出的准确回答。

[在这里放一张你的 Python 代码截图，或者数据清洗的截图]
> **图 2：** 数据预处理与本地自动化处理脚本展示。

## 📂 仓库目录说明
```text
📦 Shadow-Analyst
 ┣ 📂 scripts/              # 数据爬取与清洗的 Python 脚本 (Pandas, BeautifulSoup等)
 ┣ 📂 sample_data/          # 脱敏后的示例输入数据 (部分公开的研报 PDF/TXT)
 ┣ 📂 prompts/              # 针对投研场景优化过的 System Prompts
 ┣ 📜 terminal_ui.py        # 本地微终端交互界面源码
 ┣ 📜 requirements.txt      # 环境依赖包
 ┗ 📜 README.md             # 项目说明文档
