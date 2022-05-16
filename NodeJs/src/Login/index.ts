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
      body: JSON.stringify(result),
    };
  } catch (err) {
    return handleError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent): Promise<object> => {
  let params = initParams(ev)
  params = await validateData(params)
  return await authenticationCognito(params);
}

function initParams(ev: APIGatewayProxyEvent): object {
  return JSON.parse(ev.body || "{}");
}

const validateData = async (params: object): Promise<object> => {
  const schema = joi
    .object({
      email: joi.string().trim().required().email().min(5),
      password: joi.string().trim().required().min(8).max(30)
    }).options({ abortEarly: false })
  return await schema.validateAsync(params);
}

const authenticationCognito = async (body: any): Promise<object> => {
  const result = await cognito
    .initiateAuth({
      ClientId: COGNITO_CLIENT_ID,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    })
    .promise();
  const idToken = result.AuthenticationResult?.IdToken;
  const accessToken = result.AuthenticationResult?.AccessToken;
  const refreshToken = result.AuthenticationResult?.RefreshToken;
  return { idToken, accessToken, refreshToken };
};

const handleError = (err: any): APIGatewayProxyResult => {

  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err }),
    };
  }

  if (err.code === "UserNotConfirmedException") {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Your account is not verified!" }),
    };
  }

  if (err.code === "NotAuthorizedException" || err.code === "UserNotFoundException"
  ) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Incorrect username or password" }),
    };
  }

  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};