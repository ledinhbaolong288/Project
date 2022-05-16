import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { v4 as uuidv4 } from 'uuid';
import aws from "aws-sdk"
import joi, { ValidationError } from "joi";
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || ""
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
  await checkCategoryExit(params.category_id)
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
      product_name: joi.string().trim().required(),
      price: joi.number().required(),
      category_id: joi.string().trim().required(),
    }).options({ abortEarly: false })
  return await schema.validateAsync(params)
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
}

const createProduct = async (body: any): Promise<object> => {
  body.product_id = uuidv4();
  const At = new Date().getTime()
  body.createdAt = At
  body.updatedAt = At
  body.thumbnail = "";
  body.image = "";
  const params = {
    TableName: PRODUCT_TABLE_NAME,
    Item: body
  }
  await dynamodb.put(params).promise()
  return {
    product_id: body.product_id
  }
}

const handleError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err }),
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
