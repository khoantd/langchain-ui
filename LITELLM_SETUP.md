# LiteLLM Integration Setup

This application now supports LiteLLM integration for AI-powered chat responses.

## Setup Instructions

### 1. Get LiteLLM API Key

1. Go to [LiteLLM Dashboard](https://litellm.ai/)
2. Create an account or sign in
3. Navigate to API keys section
4. Generate a new API key
5. Copy the API key (starts with 'sk-')

### 2. Configure in Application

1. Go to **Settings** page in the application
2. Scroll down to **LiteLLM Configuration** section
3. Enter your LiteLLM API key
4. Configure LiteLLM URL (optional - defaults to official endpoint)
5. Click **Test Connection** to verify setup
6. Click **Save Configuration**

### 3. Configure LiteLLM URL (Optional)

For advanced users, you can configure a custom LiteLLM endpoint:

**Use Cases:**
- **Self-hosted LiteLLM instance** - Deploy your own LiteLLM server
- **Proxy/Custom endpoint** - Route through your own infrastructure
- **Development environments** - Test against local LiteLLM instance

**Configuration Options:**
- **Default**: `https://litellm.ai/api/v1` (Official LiteLLM service)
- **Self-hosted**: `http://localhost:4000/api/v1`
- **Custom proxy**: `https://your-proxy.com/api/v1`

### 4. Configure LiteLLM Models

You can configure different AI models in LiteLLM:
- OpenAI models (GPT-3.5, GPT-4, etc.)
- Anthropic models (Claude)
- Google models (Gemini)
- And many more

### 4. Usage

1. Create or select a chatbot
2. Start chatting
3. The application will use LiteLLM to generate AI responses

## Features

- **Multiple Model Support**: Use any model supported by LiteLLM
- **Prompt Templates**: AI responses use your configured prompt templates
- **Cost Management**: Track usage through LiteLLM dashboard
- **Easy Configuration**: Simple API key setup through settings

## Default Configuration

The application currently uses:
- Model: `gpt-3.5-turbo`
- Temperature: `0.7` 
- Max tokens: `1000`

You can modify these values in the API endpoint for customization.

## Using LiteLLM Proxy

Your current setup is configured to use a LiteLLM proxy at `https://litellm.khoadue.me/api/v1`.

### Proxy Configuration Benefits:
- **Custom Integration**: Route through your own infrastructure
- **Enhanced Privacy**: Control data flow through your proxy
- **Custom Models**: Configure specific models through your proxy
- **Cost Management**: Centralized billing and usage tracking

### Current Configuration:
- **Proxy URL**: `https://litellm.khoadue.me/api/v1`
- **API Key**: Configured
- **Fallback Enabled**: Intelligent responses when proxy unavailable

## Self-Hosting LiteLLM

For enterprise or privacy-focused deployments, you can self-host LiteLLM:

### Installation

```bash
pip install litellm
```

### Basic Server Setup

```python
from litellm import completion
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.post("/chat/completions")
async def chat_completions(request):
    response = completion(**request)
    return response

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)
```

### Configure in Application

1. Set URL to: `http://your-server-ip:4000/api/v1`
2. Test connection using the **Test Connection** button
3. Save configuration

## Troubleshooting

### API Key Issues
- Ensure API key starts with 'sk-'
- Check if key has valid credits
- Verify key is saved correctly in settings

### Response Issues
- Check LiteLLM dashboard for model availability
- Monitor rate limits
- Review prompt template configuration

### Network Issues
- Ensure stable internet connection
- Check LiteLLM service status
- Verify firewall settings