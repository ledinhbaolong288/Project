import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";
import joi, { ValidationError } from "joi";
const cognito = new CognitoIdentityServiceProvider();
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || "";

export const handler: APIGatewayProxyHandler = async (ev: any) => {
  try {
    const result = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Sign Up Success" }),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<any> => {
  let params = initParams(ev);
  params = await validateData(params);
  return await confirmSignUp(params);
};

function initParams(ev: APIGatewayProxyEvent): object {
  return JSON.parse(ev.body || "{}");
}

const validateData = async (params: object): Promise<object> => {
  const schema = joi
    .object({
      code: joi.string().required().trim(),
      email: joi.string().required().email().min(5),
    })
  return await schema.validateAsync(params);
};

const confirmSignUp = async (body: any): Promise<void> => {
  await cognito.confirmSignUp({
    ClientId: COGNITO_CLIENT_ID,
    Username: body.email,
    ConfirmationCode: body.code
  }).promise()
};

const handleError = (err: any): APIGatewayProxyResult => {

  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err }),
    };
  }

  if (err.code === "UserNotFoundException") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Incorrect username" }),
    }
  }

  if (err.code === "CodeMismatchException" || err.code === "ExpiredCodeException") {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Your code is invalid" }),
    };
  }

  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};
