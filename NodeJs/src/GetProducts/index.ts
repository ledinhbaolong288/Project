import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws, { S3 } from "aws-sdk"
const s3 = new S3({ signatureVersion: "v4" });
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
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
  const params = await getProduct()
  return await product(params)
}

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

const getProduct = async (): Promise<any> => {
  const products = await dynamodb
    .scan({
      TableName: PRODUCT_TABLE_NAME
    }).promise()
  return products.Items
}

const product = async (params: any): Promise<any> => {
  let products = []
  for (let i = 0; i < params.length; i++) {
    delete params[i].image;
    if (params[i].thumbnail != "")
      params[i].thumbnail = await getURLThumbnail(params[i].thumbnail)
    products.push(params[i])
  }
  return products
}

async function getURLThumbnail(product: any): Promise<any> {
  return s3.getSignedUrl("getObject", {
    Bucket: S3_BUCKET_NAME,
    Key: product
  });
}

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