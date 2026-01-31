import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";

const promptTemplateHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest
  
  const { promptId } = request.query;

  if (request.method === "DELETE") {
    const data = await prismaClient.promptTemplate.delete({
      where: {
        id: parseInt(promptId),
      },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  if (request.method === "PATCH") {
    const data = await prismaClient.promptTemplate.update({
      where: {
        id: parseInt(promptId),
      },
      data: { ...request.body },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }
};

export default promptTemplateHandler;