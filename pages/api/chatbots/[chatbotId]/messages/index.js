import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";

export const chatbotMessagesHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest
  
  const { chatbotId } = request.query;

  // Validate chatbot exists and belongs to user
  const chatbot = await prismaClient.chatbot.findFirst({
    where: {
      id: parseInt(chatbotId),
      userId: user.id,
    },
  });

  if (!chatbot) {
    return response.status(404).json({ 
      success: false, 
      error: "Chatbot not found or access denied" 
    });
  }

  if (request.method === "POST") {
    const { message, agent } = request.body;
    
    const chatbotMessage = await prismaClient.chatbotMessage.create({
      data: {
        chatbotId: parseInt(chatbotId),
        message,
        agent,
      },
    });

    return response.status(200).json({ success: true, data: chatbotMessage });
  }

  if (request.method === "GET") {
    const messages = await prismaClient.chatbotMessage.findMany({
      where: { chatbotId: parseInt(chatbotId) },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    return response.status(200).json({ success: true, data: messages });
  }
};

export default chatbotMessagesHandler;