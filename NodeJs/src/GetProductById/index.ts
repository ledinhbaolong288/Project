import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import aws, { S3 } from "aws-sdk"
const s3 = new S3({ signatureVersion: "v4" })
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || ""
const dynamodb = new aws.DynamoDB.DocumentClient();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || ""
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
  let product = await getProduct(id)
  product = await getUrlS3(product)
  return product
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

const getProduct = async (product_id: string): Promise<any> => {
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
  delete item.thumbnail
  return item;
}

const getUrlS3 = async (product: any): Promise<any> => {
  if (product.image != "") {
    const linkImage = s3.getSignedUrl("getObject", {
      Bucket: S3_BUCKET_NAME,
      Key: product.image
    });
    product.image = linkImage
  }
  return product
}

const handleError = (err: any): APIGatewayProxyResult => {
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