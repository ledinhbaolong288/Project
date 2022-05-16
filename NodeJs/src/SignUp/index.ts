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
      body: JSON.stringify({ message: "Confirm code to Sign Up" }),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<any> => {
  let params = initParams(ev);
  params = await validateData(params);
  return signUpUser(params);
};

const initParams = (ev: APIGatewayProxyEvent) => {
  return JSON.parse(ev.body || "{}")
}

const validateData = async (params: any) => {
  const schema = joi
    .object({
      email: joi.string().email().min(8).required(),
      password: joi.string().trim().min(8).max(30).required()
    }).options({ abortEarly: false })
  let value = await schema.validateAsync(params);
  value.role = "user";
  return value
}

const signUpUser = async (body: any): Promise<void> => {
  await cognito
    .signUp({
      ClientId: COGNITO_CLIENT_ID,
      Password: body.password,
      Username: body.email,
      UserAttributes: [
        {
          Name: "email",
          Value: body.email,
        },
        {
          Name: "custom:role",
          Value: body.role,
        },
      ],
    })
    .promise();
};

const handleError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err }),
    };
  }

  if (err.code === "UsernameExistsException") {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Your username is already exists" }),
    }
  }

  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  }
};