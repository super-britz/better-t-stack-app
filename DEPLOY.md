# 手动部署 Hono 到 AWS Lambda 踩坑记录

## 完整部署步骤

### 前置条件
- AWS 账号（使用 IAM 用户，不要用根用户）
- AWS CLI 已安装
- pnpm 已安装

### 1. 配置 AWS 凭证
```bash
aws configure
# 输入 Access Key ID、Secret Access Key、region、output format

# 验证配置成功
aws sts get-caller-identity
```

### 2. 构建代码
```bash
pnpm run build --filter server
```

### 3. 打包成 zip
```bash
cd apps/server/dist
zip -r ../lambda.zip .
cd ../../..
```

### 4. 创建 IAM Role
```bash
aws iam create-role \
  --role-name better-t-stack-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name better-t-stack-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 5. 创建 S3 Bucket 并上传代码
```bash
aws s3 mb s3://better-t-stack-deploy-<账号ID> --region ap-southeast-1

aws s3 cp apps/server/lambda.zip \
  s3://better-t-stack-deploy-<账号ID>/lambda.zip
```

### 6. 创建 Lambda 函数
```bash
aws lambda create-function \
  --function-name better-t-stack-api \
  --runtime nodejs22.x \
  --role arn:aws:iam::<账号ID>:role/better-t-stack-lambda-role \
  --handler index.handler \
  --code S3Bucket=better-t-stack-deploy-<账号ID>,S3Key=lambda.zip \
  --timeout 30 \
  --memory-size 512 \
  --region ap-southeast-1
```

### 7. 创建 API Gateway
```bash
# 创建 API
aws apigatewayv2 create-api \
  --name better-t-stack-api \
  --protocol-type HTTP \
  --region ap-southeast-1

# 创建集成（记下 IntegrationId）
aws apigatewayv2 create-integration \
  --api-id <ApiId> \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:ap-southeast-1:<账号ID>:function:better-t-stack-api \
  --payload-format-version 2.0 \
  --region ap-southeast-1

# 创建路由
aws apigatewayv2 create-route \
  --api-id <ApiId> \
  --route-key '$default' \
  --target integrations/<IntegrationId> \
  --region ap-southeast-1

# 创建 stage
aws apigatewayv2 create-stage \
  --api-id <ApiId> \
  --stage-name '$default' \
  --auto-deploy \
  --region ap-southeast-1

# 授权 API Gateway 调用 Lambda
aws lambda add-permission \
  --function-name better-t-stack-api \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:ap-southeast-1:<账号ID>:<ApiId>/*" \
  --region ap-southeast-1
```

### 8. 设置环境变量
```bash
aws lambda update-function-configuration \
  --function-name better-t-stack-api \
  --environment Variables="{DATABASE_URL=<数据库连接串>,CORS_ORIGIN=<前端地址>}" \
  --region ap-southeast-1
```

### 9. 更新代码（后续迭代用）
```bash
pnpm run build --filter server
cd apps/server/dist && zip -r ../lambda.zip . && cd ../../..
aws s3 cp apps/server/lambda.zip s3://better-t-stack-deploy-<账号ID>/lambda.zip
aws lambda update-function-code \
  --function-name better-t-stack-api \
  --s3-bucket better-t-stack-deploy-<账号ID> \
  --s3-key lambda.zip \
  --region ap-southeast-1
```

---

## 踩坑记录

### 坑 1：根用户不能直接用

**现象**：用根用户的 Access Key 操作 AWS CLI

**问题**：根用户拥有账号所有权限，Access Key 泄露等于整个账号被接管

**解决**：
1. 用根用户创建 IAM 用户
2. 给 IAM 用户附加 `AdministratorAccess` 策略
3. 用 IAM 用户的 Access Key 配置 CLI
4. 根用户只用来管理账单和创建 IAM 用户

---

### 坑 2：第三方依赖没有 bundle 进去

**现象**：
```
Error: Cannot find package 'zod' imported from /var/task/index.mjs
```

**原因**：`tsdown.config.ts` 里 `noExternal` 只 bundle 了 workspace 包，`zod`、`hono` 等第三方依赖没有打包进去。Lambda 运行环境里没有 `node_modules`，所以找不到。

**解决**：修改 `apps/server/tsdown.config.ts`：
```ts
// 修改前
noExternal: [/@better-t-stack-app\/.*/]

// 修改后
noExternal: [/^(?!node:).*/]  // 除了 Node.js 内置模块，其他全部 bundle
```

---

### 坑 3：忘记设置环境变量

**现象**：
```
❌ Invalid environment variables:
  - DATABASE_URL: Invalid input
  - CORS_ORIGIN: Invalid input
```

**原因**：创建 Lambda 时没有传 `--environment` 参数，`packages/env/src/server.ts` 用 Zod 校验环境变量，启动时直接报错退出。

**解决**：
```bash
aws lambda update-function-configuration \
  --function-name better-t-stack-api \
  --environment Variables="{DATABASE_URL=xxx,CORS_ORIGIN=xxx}" \
  --region ap-southeast-1
```

---

### 坑 4：index.ts 没有导出 Lambda handler

**现象**：
```
Runtime.HandlerNotFound: index.handler is undefined or not exported
Server is running on http://localhost:3000  ← 走了本地模式
```

**原因**：原始 `index.ts` 只有本地 `serve` 模式，没有导出 `handler` 函数供 Lambda 调用。

**解决**：修改 `apps/server/src/index.ts`，同时支持两种模式：
```ts
// Lambda 入口
export const handler = async (event: any, context: any) => {
  const { handle } = await import("hono/aws-lambda");
  return handle(app)(event, context);
};

// 本地开发（AWS_LAMBDA_FUNCTION_NAME 是 Lambda 运行时自动注入的环境变量）
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const { serve } = await import("@hono/node-server");
  serve(
    { fetch: app.fetch, port: 3000 },
    (info) => console.log(`Server is running on http://localhost:${info.port}`),
  );
}
```

**关键点**：`AWS_LAMBDA_FUNCTION_NAME` 是 Lambda 运行时自动注入的环境变量，本地没有这个变量，所以可以用它来区分两种运行环境。

---

## 查看日志

```bash
# 查看最近的日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/better-t-stack-api \
  --region ap-southeast-1 \
  --start-time $(date -v-5m +%s000) \
  --query 'events[*].message' \
  --output text
```
