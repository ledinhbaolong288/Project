import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws from "aws-sdk"
const CATEGORY_TABLE_NAME = process.env.CATEGORY_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const ADMIN = ["admin"]

export const handler: APIGatewayProxyHandler = async (ev: any) => {
  try {
    await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Delete Success" }),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<any> => {
  const { id, role } = initParams(ev)
  checkRole(role)
  await checkCategoryExit(id)
  return deleteCategory(id)
}

const initParams = (ev: APIGatewayProxyEvent) => {
  const id = ev.pathParameters?.id || ""
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  return { id, role }
}

const checkRole = (role: string): void => {
  if (!(ADMIN.includes(role))) {
    throw {
      code: "NotPermission",
    };
  }
};

const checkCategoryExit = async (category_id: string) => {
  const { Item: item } = await dynamodb
    .get({
      TableName: CATEGORY_TABLE_NAME,
      Key: { category_id }
    }).promise()

  if (!item) {
    throw {
      code: "NotFound"
    }
  }
}

const deleteCategory = (category_id: string) => {
  return dynamodb
    .delete({
      TableName: CATEGORY_TABLE_NAME,
      Key: { category_id }
    }).promise()
}

const handleError = (err: any): APIGatewayProxyResult => {
  if (err.code === "NotFound") {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not Found Category" })
    }
  }

  if (err.code === "NotPermission") {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Don't have Permission" }),
    };
  }

  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};