import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws from "aws-sdk"
import joi, { ValidationError } from "joi";
const CATEGORY_TABLE_NAME = process.env.CATEGORY_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const ADMIN = ["admin"]

export const handler: APIGatewayProxyHandler = async (ev: any) => {
  try {
    await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Update Success" }),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<object> => {
  const { id, params, role } = initParams(ev)
  checkRole(role)
  const value = await validateCategory(params)
  const category = await checkCategoryExit(id)
  const data = { ...category, ...value }
  return await updateCategory(data);
};

const initParams = (ev: APIGatewayProxyEvent) => {
  const id = ev.pathParameters?.id || ""
  const params = JSON.parse(ev.body || "{}")
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  return { id, params, role }
}

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
  return item
}

const checkRole = (role: string): void => {
  if (!(ADMIN.includes(role))) {
    throw {
      code: "NotPermission",
    };
  }
};

const validateCategory = async (params: object): Promise<object> => {
  const schema = joi
    .object({
      category_name: joi.string().trim().required()
    }).options({ abortEarly: true })
  return await schema.validateAsync(params)
}

const updateCategory = async (data: object) => {
  return await dynamodb
    .put({
      TableName: CATEGORY_TABLE_NAME,
      Item: data
    }).promise()
}

const handleError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    }
  }

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