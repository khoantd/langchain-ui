import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";

const chatbotHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest
  
  const { chatbotId } = request.query;

  if (request.method === "DELETE") {
    const data = await prismaClient.chatbot.delete({
      where: {
        id: parseInt(chatbotId),
      },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  if (request.method === "GET") {
    const data = await prismaClient.chatbot.findUnique({
      where: {
        id: parseInt(chatbotId),
      },
      include: {
        datasource: true,
        promptTemplate: true,
      },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  if (request.method === "PATCH") {
    const data = await prismaClient.chatbot.update({
      where: {
        id: parseInt(chatbotId),
      },
      data: { ...request.body },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }
};

export default chatbotHandler;