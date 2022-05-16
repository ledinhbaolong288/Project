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

const main = async (ev: APIGatewayProxyEvent): Promise<any> => {
  const { id, role } = initParams(ev)
  checkRole(role)
  let category = await getCategory(id)
  return category
}

const initParams = (ev: APIGatewayProxyEvent) => {
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  const id = ev.pathParameters?.id || ""
  return { id, role }
}

const checkRole = (role: string): void => {
  if (!(ADMIN.includes(role))) {
    throw {
      code: "NotPermission",
    };
  }
};

const getCategory = async (category_id: string): Promise<any> => {
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
  return item;
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