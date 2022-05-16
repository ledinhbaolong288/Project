import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws from "aws-sdk"
import joi, { ValidationError } from "joi";
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || ""
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
  const value = await validateProduct(params)
  const category = await checkProductExit(id)
  const data = { ...category, ...value }
  return await updateProduct(data);
};

const initParams = (ev: APIGatewayProxyEvent) => {
  const id = ev.pathParameters?.id || ""
  const params = JSON.parse(ev.body || "{}")
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  return { id, params, role }
}

const checkProductExit = async (product_id: string) => {
  const { Item: item } = await dynamodb
    .get({
      TableName: PRODUCT_TABLE_NAME,
      Key: { product_id }
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

const validateProduct = async (params: object): Promise<object> => {
  const schema = joi
    .object({
      product_name: joi.string().trim(),
      price: joi.number(),
      category_id: joi.string().trim()
    }).options({ abortEarly: false })
  return await schema.validateAsync(params)
}

const updateProduct = async (data: any) => {
  data.updatedAt = new Date().getTime()
  return await dynamodb
    .put({
      TableName: PRODUCT_TABLE_NAME,
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
      body: JSON.stringify({ message: "Not Found Product" })
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