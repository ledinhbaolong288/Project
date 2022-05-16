import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws, { S3 } from "aws-sdk"
import { ValidationError } from "joi";
const s3 = new S3({ signatureVersion: "v4" });
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
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
  const { contentType, id, role } = initParams(ev)
  checkRole(role)
  const key = validateImageType(contentType, id)
  getProduct(id)
  const url = getURLS3Product(key)
  await updateProduct(id, key)
  return url
}

const initParams = (ev: APIGatewayProxyEvent): any => {
  const contentType = ev.headers["Content-Type"] || "";
  const role = ev.requestContext.authorizer?.claims['custom:role'] || "";
  const id = ev.pathParameters?.id || ""
  return { contentType, id, role }
}

const checkRole = (role: string): void => {
  if (!ADMIN.includes(role)) {
    throw {
      code: "NotPermission",
    };
  }
};

const validateImageType = (contentType: string, id: string): string => {
  const key = `images/products/${id}`;
  if (contentType === "image/png") {
    return key + ".png";
  } else if (contentType === "image/jpeg") {
    return key + ".jpg";
  } else {
    throw {
      code: "InvalidImageType",
    };
  }
};

const getProduct = async (product_id: string): Promise<object> => {
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

const getURLS3Product = (key: string): any => {
  const url = s3.getSignedUrl("putObject", {
    Bucket: S3_BUCKET_NAME,
    Key: key
  })
  return url
}

const updateProduct = async (product_id: string, key: string): Promise<any> => {
  await dynamodb.update({
    TableName: PRODUCT_TABLE_NAME,
    Key: { product_id },
    UpdateExpression: "set image = :image, updatedAt = :update",
    ExpressionAttributeValues: {
      ":image": key,
      ":update": new Date().getTime(),
    }
  }).promise()
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

  if (err.code === "NotFound") {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not Found Product" }),
    };
  }

  if (err.code === "InvalidImageType") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid Image Type" }),
    };
  }

  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};