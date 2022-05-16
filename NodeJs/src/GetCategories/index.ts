import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws from "aws-sdk"
const CATEGORY_TABLE_NAME = process.env.CATEGORY_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const ADMIN = ["admin", "user"]

export const handler: APIGatewayProxyHandler = async (ev: any) => {
  try {
    const result = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<object> => {
  const role = initParams(ev)
  checkRole(role)
  return await getCategories()
};

const initParams = (ev: APIGatewayProxyEvent): any => {
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  return role
};

const checkRole = (role: string): void => {
  if (!ADMIN.includes(role)) {
    throw {
      code: "NotPermission",
    };
  }
};

const getCategories = async (): Promise<any> => {
  const categories = await dynamodb
    .scan({
      TableName: CATEGORY_TABLE_NAME
    }).promise()
  return categories.Items
};

const handleError = (err: any): APIGatewayProxyResult => {
  if (err.code === "NotPermission") {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Don't have Permission" }),
    };
  }

  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};