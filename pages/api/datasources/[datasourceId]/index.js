import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";

const datasourceHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest
  
  const { datasourceId } = request.query;

  if (request.method === "DELETE") {
    const data = await prismaClient.datasource.delete({
      where: {
        id: parseInt(datasourceId),
      },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  if (request.method === "PATCH") {
    const data = await prismaClient.datasource.update({
      where: {
        id: parseInt(datasourceId),
      },
      data: { ...request.body },
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }
};

export default datasourceHandler;