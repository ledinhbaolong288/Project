import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { v4 as uuidv4 } from 'uuid';
import aws from "aws-sdk"
import joi, { ValidationError } from "joi";
const CATEGORY_TABLE_NAME = process.env.CATEGORY_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const ADMIN = ["admin"]

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
  let { params, role } = initParams(ev);
  checkRole(role)
  const value = await validateData(params);
  return await createProduct(value);
};

const initParams = (ev: APIGatewayProxyEvent): any => {
  const params = JSON.parse(ev.body || "{}")
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  return { params, role }
}

const checkRole = (role: string): void => {
  if (!(ADMIN.includes(role))) {
    throw {
      code: "NotPermission",
    };
  }
};

const validateData = async (params: object): Promise<object> => {
  const schema = joi
    .object({
      category_name: joi.string().trim().required()
    }).options({ abortEarly: true })
  return await schema.validateAsync(params)
}

const createProduct = async (body: any): Promise<object> => {
  body.category_id = uuidv4();
  const params = {
    TableName: CATEGORY_TABLE_NAME,
    Item: body
  }
  await dynamodb.put(params).promise()
  return {
    category_id: body.category_id
  }
}

const handleError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err }),
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
