import { authenticateRequest } from "../auth-helper";
import { prismaClient } from "@/lib/prisma";

const chatbotsHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest

  if (request.method === "GET") {
    const data = await prismaClient.chatbot.findMany({
      where: {
        userId: {
          equals: user.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  if (request.method === "POST") {
    const chatbot = await prismaClient.chatbot.create({
      data: {
        userId: user.id,
        ...request.body,
      },
    });

    return response.status(200).json({ sucess: true, data: chatbot });
  }
};

export default chatbotsHandler;
