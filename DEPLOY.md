# 手动部署 Hono 到 AWS Lambda 踩坑记录

## 每一步在做什么

### 第一步：aws configure

你在本地终端操作 AWS，AWS 需要知道你是谁、有没有权限。`aws configure` 就是把你的身份信息（Access Key）保存到本地，之后每次运行 AWS 命令都会自动带上这个身份。

### 第二步：构建 + 打包

```
TypeScript 代码  →  pnpm build  →  index.mjs  →  zip  →  lambda.zip
```

Lambda 只能运行 JavaScript，不能直接运行 TypeScript，所以要先编译。zip 是 AWS 规定的部署格式。

### 第三步：IAM Role

Lambda 运行时需要权限才能操作 AWS 服务（写日志、连数据库等）。IAM Role 就是给 Lambda 颁发的"通行证"，上面写着它能做什么。

```
create-role            →  创建通行证
attach-role-policy     →  在通行证上写"可以写 CloudWatch 日志"
```

### 第四步：S3 + 上传代码

Lambda 的代码需要存在某个地方，S3 就是这个存储的地方。

```
本地 lambda.zip  →  上传到 S3  →  Lambda 从 S3 拿代码
```

### 第五步：创建 Lambda

把代码、运行环境、权限、配置组合在一起，创建一个可以运行的函数：

```
代码在哪    →  S3 里的 lambda.zip
用什么跑    →  nodejs22.x
有什么权限  →  IAM Role
入口在哪    →  index.handler
```

### 第六步：API Gateway

Lambda 创建好之后只是一个函数，没有网址，外面访问不到。API Gateway 的作用是：

```
公网请求  →  API Gateway  →  触发 Lambda  →  返回结果
```

这一步分了四个小步骤：

```
create-api          →  创建一个 HTTP API
create-integration  →  告诉 API Gateway 把请求转发给哪个 Lambda
create-route        →  配置哪些路径触发这个转发
create-stage        →  让 API 正式上线可以访问
add-permission      →  授权 API Gateway 有权调用 Lambda
```

### 第七步：RDS

Lambda 里的代码需要连接数据库，本地用 Docker 跑 PostgreSQL，AWS 上用 RDS。

```
create-db-subnet-group   →  告诉 RDS 可以用哪些子网（网络配置）
create-security-group    →  创建防火墙规则，控制谁能访问数据库
authorize-ingress        →  开放 5432 端口允许连接
create-db-instance       →  创建真正的 PostgreSQL 数据库
```

---

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

### 8. 创建 RDS PostgreSQL
```bash
# 查看默认子网
aws ec2 describe-subnets \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[*].{SubnetId:SubnetId,AZ:AvailabilityZone}' \
  --region ap-southeast-1 \
  --output table

# 创建子网组
aws rds create-db-subnet-group \
  --db-subnet-group-name better-t-stack-subnet-group \
  --db-subnet-group-description "better-t-stack RDS subnet group" \
  --subnet-ids <SubnetId1> <SubnetId2> <SubnetId3> \
  --region ap-southeast-1

# 创建 Security Group
aws ec2 create-security-group \
  --group-name better-t-stack-rds-sg \
  --description "RDS security group for better-t-stack" \
  --vpc-id <VpcId> \
  --region ap-southeast-1

# 开放 5432 端口（注意：0.0.0.0/0 仅用于测试，生产环境要限制来源）
aws ec2 authorize-security-group-ingress \
  --group-id <SecurityGroupId> \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region ap-southeast-1

# 创建 RDS 实例（注意：db-name 只能用字母和数字，不能有连字符）
aws rds create-db-instance \
  --db-instance-identifier better-t-stack-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password <你的密码> \
  --db-name bettertstack \
  --db-subnet-group-name better-t-stack-subnet-group \
  --vpc-security-group-ids <SecurityGroupId> \
  --publicly-accessible \
  --allocated-storage 20 \
  --no-multi-az \
  --region ap-southeast-1

# 等待 RDS 创建完成
aws rds wait db-instance-available \
  --db-instance-identifier better-t-stack-db \
  --region ap-southeast-1

# 获取 RDS 地址
aws rds describe-db-instances \
  --db-instance-identifier better-t-stack-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --region ap-southeast-1
```

### 9. 推送表结构到 RDS

注意：不能用 `pnpm run db:push`，因为 `drizzle.config.ts` 里的 `dotenv.config` 会强制读取 `apps/server/.env`，覆盖外部传入的环境变量。要直接用 `npx drizzle-kit push`：

```bash
cd packages/db

DATABASE_URL="postgresql://postgres:<密码>@<RDS地址>:5432/bettertstack?sslmode=no-verify" npx drizzle-kit push
```

### 10. 设置 Lambda 环境变量

注意：RDS 连接串必须加 `?sslmode=no-verify`，否则 SSL 证书验证失败。

```bash
aws lambda update-function-configuration \
  --function-name better-t-stack-api \
  --environment Variables="{DATABASE_URL=postgresql://postgres:<密码>@<RDS地址>:5432/bettertstack?sslmode=no-verify,CORS_ORIGIN=<前端地址>}" \
  --region ap-southeast-1
```

### 11. 更新代码（后续迭代用）
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
2. 给 IAM 用户附加 `AdministratorAccess` 策略（Type 选 AWS managed）
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

### 坑 5：RDS 数据库名不能有连字符

**现象**：
```
An error occurred (InvalidParameterValue): DBName must begin with a letter and contain only alphanumeric characters.
```

**原因**：`--db-name better-t-stack-app` 里有连字符 `-`，RDS 不允许。

**解决**：改成纯字母数字，比如 `--db-name bettertstack`

---

### 坑 6：drizzle.config.ts 里的 dotenv 覆盖外部环境变量

**现象**：
```bash
DATABASE_URL="postgresql://...rds..." pnpm run db:push
# 输出：No changes detected  ← 实际连的是本地数据库
```

**原因**：`drizzle.config.ts` 里有这段代码：
```ts
dotenv.config({ path: "../../apps/server/.env" })
```
这会强制读取本地 `.env` 文件，覆盖外部传入的 `DATABASE_URL`。

**解决**：绕过 turbo，直接在 `packages/db` 目录下运行 `npx drizzle-kit push`：
```bash
cd packages/db
DATABASE_URL="postgresql://...rds...?sslmode=no-verify" npx drizzle-kit push
```

---

### 坑 7：RDS 连接需要 SSL

**现象**：
```
no pg_hba.conf entry for host "x.x.x.x", no encryption
# 或
Error: self-signed certificate in certificate chain
```

**原因**：AWS RDS 默认要求 SSL 加密连接，本地连接和 Lambda 连接都需要带上 SSL 参数。

**解决**：在 `DATABASE_URL` 末尾加上 `?sslmode=no-verify`：
```
postgresql://postgres:<密码>@<RDS地址>:5432/bettertstack?sslmode=no-verify
```

---

## 环境变量管理

### 为什么生产环境变量不放在 .env 文件里

如果把生产环境变量放在 `.env` 文件里：

```
风险 1：不小心提交到 Git → 密码上传到 GitHub → 任何人都能看到
风险 2：本地文件泄露   → 电脑被盗、截图、共享屏幕 → 密码暴露
风险 3：多人协作传递   → 通过微信/邮件传输密码 → 不安全
```

生产环境变量存在云平台的加密存储里，只有有权限的人才能看到：

```
Lambda 环境变量   → 存在 AWS 加密存储，通过 aws lambda update-function-configuration 设置
Cloudflare Pages  → 存在 Cloudflare 加密存储，在控制台 Settings → Environment variables 设置
```

### 开发 vs 生产 对比

| 变量 | 开发环境 | 生产环境 |
|------|---------|----------|
| `DATABASE_URL` | `localhost:5432`（Docker） | RDS 地址 + `?sslmode=no-verify` |
| `CORS_ORIGIN` | `http://localhost:3001` | Cloudflare Pages 域名 |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3000` | API Gateway 地址 |

### 文件说明

```
apps/server/
├── .env                      ← 本地开发用（不提交 Git）
├── .env.example              ← 开发环境模板（提交 Git，给团队参考）
└── .env.production.example   ← 生产环境说明（提交 Git）

apps/web/
├── .env                      ← 本地开发用（不提交 Git）
├── .env.example              ← 开发环境模板（提交 Git）
└── .env.production.example   ← 生产环境说明（提交 Git）
```

---

## API 接口列表

所有接口都在 API Gateway 地址下，路径以 `/trpc/` 开头。

| 接口 | 类型 | 说明 |
|------|------|------|
| `healthCheck` | GET（query） | 健康检查 |
| `listGithubProfiles` | GET（query） | 查询所有 GitHub profiles |
| `githubProfile` | POST（mutation） | 新增 GitHub profile |
| `updateGithubProfile` | POST（mutation） | 更新 GitHub profile |
| `deleteGithubProfile` | POST（mutation） | 删除 GitHub profile |

### GET 接口（query）

```bash
# 健康检查
curl https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/healthCheck

# 查询所有 GitHub profiles
curl https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/listGithubProfiles
```

### POST 接口（mutation）

tRPC 的请求体有固定格式，数据必须包在 `json` 字段里：

```bash
# 新增 GitHub profile
curl -X POST \
  https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/githubProfile \
  -H "Content-Type: application/json" \
  -d '{"json":{"token":"your-github-token"}}'

# 更新 GitHub profile
curl -X POST \
  https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/updateGithubProfile \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1,"token":"your-github-token"}}'

# 删除 GitHub profile
curl -X POST \
  https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/deleteGithubProfile \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1}}'
```

注意：tRPC 请求体格式是 `{"json": {...}}`，不是普通的 `{...}`，这是 tRPC 协议规定的。前端调用时 tRPC 客户端会自动处理，手动 curl 时需要注意。

---

## 查看日志

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/better-t-stack-api \
  --region ap-southeast-1 \
  --start-time $(date -v-5m +%s000) \
  --query 'events[*].message' \
  --output text
```
