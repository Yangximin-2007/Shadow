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
4.这是我基于Ollama下的qwen3模型，在AnythingLLM平台上进行的模型训练项目
这个项目的基本思想是通过训练模型，使模型达到专业分析师的水平，从而成为公司企业的“影子员工”
具体的路径是通过对各个不同行业的股票进行有区分的筛选信息（比如医药关注科研与审批，基建关注国家财政），在让得知信息的模型对历史市场数据进行对齐，寻找出对应的逻辑与线索。
当模型对线索的“所以然”有了学习之后（这个过程比人类快许多），就让其进行实操，实地地进行训练，优化到贴合交易用途。
