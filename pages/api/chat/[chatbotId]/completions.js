import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";
import { retrieveContextFromDatasource } from "@/lib/semantic-context-retrieval";

// Fallback response generator when API fails
function generateFallbackResponse(message, promptTemplate, context = '') {
  const lowerMessage = message.toLowerCase();
  
  // Check for basic greetings first (highest priority)
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! I'm your AI assistant. How can I help you today?";
  }

  if (lowerMessage.includes('how are')) {
    return "I'm doing well, thank you for asking! I'm here to help with any questions you have.";
  }

  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return "Goodbye! Feel free to come back anytime you need assistance.";
  }

  if (lowerMessage.includes('help')) {
    return "I'm here to help! You can ask me questions about various topics, and I'll do my best to provide useful answers.";
  }

  if (lowerMessage.includes('thank')) {
    return "You're welcome! Is there anything else I can help you with?";
  }

  // If we have context, provide contextual response for other queries
  if (context) {
    // Determine response type based on query
    if (lowerMessage.includes('show') || lowerMessage.includes('data') || lowerMessage.includes('what') || lowerMessage.includes('tell') || lowerMessage.includes('give') || lowerMessage.includes('list')) {
      return "Here's the data you requested:\n\n" + context + "\n\nNote: I'm currently operating in limited mode due to API issues. For more detailed analysis and better responses, please try again later.";
    } else if (lowerMessage.includes('high') || lowerMessage.includes('low') || lowerMessage.includes('price') || lowerMessage.includes('volume')) {
      return "Based on the stock data available:\n\n" + context + "\n\nNote: I'm currently operating in limited mode. For more detailed analysis, please try again later.";
    } else {
      return "Based on the available information:\n\n" + context + "\n\nNote: I'm currently operating in limited mode due to API issues. For more detailed responses, please try again later.";
    }
  }

  // Default response (no context, no matching pattern)
  return "I understand you're asking about: '" + message + "'. As an AI assistant, I'm here to help. Could you provide more details about what specific information you're looking for?";
}

export default async function handler(req, res) {
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatbotId } = req.body;

    // Validate LiteLLM API key
    if (!process.env.LITELLM_API_KEY || !process.env.LITELLM_API_KEY.startsWith('sk-')) {
      return res.status(500).json({
        error: 'LiteLLM API key not configured or invalid format',
        details: 'Please configure a valid LiteLLM API key in Settings'
      });
    }

    // Get and validate LiteLLM URL
    const litellmUrl = process.env.LITELLM_URL || 'https://litellm.ai/api/v1';
    console.log('Using LiteLLM URL:', litellmUrl);
    console.log('LiteLLM API Key present:', !!process.env.LITELLM_API_KEY);
    console.log('LiteLLM API Key format:', process.env.LITELLM_API_KEY?.startsWith('sk-') ? 'valid' : 'invalid');
    
    // Add warning for custom URLs
    if (litellmUrl.includes('khoadue.me')) {
      console.log('Warning: Using custom LiteLLM URL that may not be accessible');
    }

    // Get the chatbot to check if user has access
    const chatbot = await prismaClient.chatbot.findFirst({
      where: {
        id: parseInt(chatbotId),
        userId: user.id,
      },
      include: {
        promptTemplate: true,
        datasource: true,
      },
    });

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Retrieve context from datasource if available
    let context = '';
    console.log('Chatbot datasource:', chatbot.datasource ? 'Found' : 'Not found');
    
    if (chatbot.datasource) {
      console.log('Datasource details:', {
        id: chatbot.datasource.id,
        name: chatbot.datasource.name,
        type: chatbot.datasource.type,
        url: chatbot.datasource.url,
        hasContent: !!chatbot.datasource.content,
        contentLength: chatbot.datasource.content?.length
      });
      
      try {
        context = await retrieveContextFromDatasource(chatbot.datasource, message);
        console.log('Context retrieval completed');
      } catch (error) {
        console.error('Error in semantic context retrieval:', error);
        // The semantic function has its own fallback, so we continue
      }
    }

    // Prepare request payload
    const requestPayload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: context 
            ? "You are a helpful AI assistant. Use the following context to answer the user's question:\n\n" + context + "\n\nIf the context doesn't contain relevant information, say so and provide a helpful response based on your general knowledge."
            : (chatbot.promptTemplate?.prompt || 'You are a helpful AI assistant.')
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    };

    console.log('Request payload:', JSON.stringify(requestPayload, null, 2));

    // Call LiteLLM with enhanced error handling
    const fullUrl = litellmUrl.replace(/\/$/, '') + '/chat/completions';
    console.log('Full request URL:', fullUrl);
    console.log('LiteLLM API Key present:', !!process.env.LITELLM_API_KEY);
    console.log('LiteLLM API Key format:', process.env.LITELLM_API_KEY?.startsWith('sk-') ? 'valid' : 'invalid');
    
    // Add warning for custom URLs
    if (litellmUrl.includes('khoadue.me')) {
      console.log('Warning: Using custom LiteLLM URL that may not be accessible');
    }

    const litellmResponse = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.LITELLM_API_KEY,
        'User-Agent': 'LangChain-UI/1.0',
      },
      body: JSON.stringify(requestPayload),
      timeout: 30000, // 30 second timeout for proxy requests
    });

    if (!litellmResponse.ok) {
      const errorText = await litellmResponse.text();
      console.error('LiteLLM error:', errorText);
      console.error('Response status:', litellmResponse.status);
      console.error('Response headers:', Object.fromEntries(litellmResponse.headers.entries()));

      // Check for specific proxy-related errors
      let errorMessage = 'Failed to generate response';
      let shouldUseFallback = true;

      if (litellmResponse.status === 401) {
        errorMessage = 'Authentication failed - Invalid API key';
      } else if (litellmResponse.status === 403) {
        errorMessage = 'Access forbidden - Check API key permissions';
      } else if (litellmResponse.status === 404) {
        errorMessage = 'Endpoint not found - Check proxy URL configuration';
      } else if (litellmResponse.status === 429) {
        errorMessage = 'Rate limit exceeded - Please try again later';
        shouldUseFallback = false; // Don't use fallback for rate limiting
      } else if (litellmResponse.status >= 500) {
        errorMessage = 'Proxy server error - Please check your LiteLLM proxy';
      }

      if (shouldUseFallback) {
        // Try fallback response with context if available
        const fallbackResponse = generateFallbackResponse(message, chatbot.promptTemplate?.prompt, context);

        // Save user message
        await prismaClient.chatbotMessage.create({
          data: {
            chatbotId: parseInt(chatbotId),
            message,
            agent: 'user',
          },
        });

        // Save fallback AI response
        await prismaClient.chatbotMessage.create({
          data: {
            chatbotId: parseInt(chatbotId),
            message: fallbackResponse,
            agent: 'ai',
          },
        });

        return res.status(200).json({
          success: true,
          response: fallbackResponse,
          fallback: true,
          proxyError: errorMessage
        });
      }
    }

    const litellmData = await litellmResponse.json();
    const aiResponse = litellmData.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    // Save user message
    await prismaClient.chatbotMessage.create({
      data: {
        chatbotId: parseInt(chatbotId),
        message,
        agent: 'user',
      },
    });

    // Save AI response
    await prismaClient.chatbotMessage.create({
      data: {
        chatbotId: parseInt(chatbotId),
        message: aiResponse,
        agent: 'ai',
      },
    });

    return res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Chat completion error:', error);
    console.error('Error stack:', error.stack);

    // Try to get context even in error case
    let context = '';
    try {
      if (chatbot?.datasource) {
        context = await retrieveContextFromDatasource(chatbot.datasource, req.body.message);
      }
    } catch (contextError) {
      console.error('Error getting context in catch block:', contextError);
    }

    // Generate contextual fallback response
    const fallbackResponse = generateFallbackResponse(req.body.message, chatbot?.promptTemplate?.prompt, context);

    // Save user message
    if (req.body && req.body.message) {
      await prismaClient.chatbotMessage.create({
        data: {
          chatbotId: parseInt(req.body.chatbotId),
          message: req.body.message,
          agent: 'user',
        },
      });
    }

    // Save fallback AI response
    await prismaClient.chatbotMessage.create({
      data: {
        chatbotId: parseInt(req.body.chatbotId),
        message: fallbackResponse,
        agent: 'ai',
      },
    });

    return res.status(200).json({
      success: true,
      response: fallbackResponse,
      fallback: true,
      error: 'API error, using fallback response'
    });
  }
}
