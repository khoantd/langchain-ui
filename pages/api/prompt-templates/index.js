import { authenticateRequest } from "../auth-helper";
import { prismaClient } from "@/lib/prisma";

const promptTemplatesHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest

  if (request.method === "GET") {
    const data = await prismaClient.promptTemplate.findMany({
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
    const { name, prompt, inputs } = request.body;
    
    const promptTemplate = await prismaClient.promptTemplate.create({
      data: {
        name,
        prompt,
        inputs: inputs || "[]",
        user: {
          connect: {
            id: user.id
          }
        },
      },
    });

    return response.status(200).json({ success: true, data: promptTemplate });
  }
};

export default promptTemplatesHandler;
