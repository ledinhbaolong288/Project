import AWS, { S3 } from "aws-sdk";
import sharp from "sharp";
import { S3Event } from "aws-lambda";

const s3 = new S3({ signatureVersion: "v4" });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const PRODUCT_TABLE_NAME = process.env.PRODUCT_TABLE_NAME || "";

export const handler: any = async (ev: any) => {
  try {
    const url = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ url: url }),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: S3Event): Promise<void> => {
  const { srcBucket, srcKey, dstKey, id } = initParams(ev);
  const getImage = await getObjectS3(srcBucket, srcKey);
  const makeThumbnail = await resizeImage(getImage);
  await putObjectS3(srcBucket, dstKey, makeThumbnail);
  await updateThumbnail(id, dstKey);
};

const initParams = (ev: S3Event): any => {
  const srcBucket = ev.Records[0].s3.bucket.name;
  const srcKey = decodeURIComponent(ev.Records[0].s3.object.key) || "";
  const dstKey = srcKey.replace("images", "thumbnails") || "";
  const id = srcKey.split("/").pop()?.split(".")[0] || "";
  return { srcBucket, srcKey, dstKey, id };
};

const getObjectS3 = async (srcBucket: string, srcKey: string): Promise<any> => {
  const image = await s3
    .getObject({
      Bucket: srcBucket,
      Key: srcKey,
    })
    .promise();
  return image;
};

const resizeImage = async (getImage: any): Promise<any> => {
  return await sharp(getImage.Body).resize(50, 50).toBuffer();
};

const putObjectS3 = async (srcBucket: string, dstKey: string, makeThumbnail: any): Promise<void> => {
  await s3
    .putObject({
      Bucket: srcBucket,
      Key: dstKey,
      Body: makeThumbnail,
      ContentType: "image",
    })
    .promise();
};

const updateThumbnail = async (product_id: string, dstKey: string): Promise<void> => {
  await dynamodb
    .update({
      TableName: PRODUCT_TABLE_NAME,
      Key: { product_id },
      UpdateExpression: "set thumbnail = :img",
      ExpressionAttributeValues: {
        ":img": dstKey,
      },
    })
    .promise();
};

const handleError = (err: any): void => {
  console.log(err);
};
