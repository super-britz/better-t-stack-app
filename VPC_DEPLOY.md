# VPC 部署：Lambda + RDS 私有网络配置

把 Lambda 和 RDS 放进同一个 VPC，RDS 不暴露公网，Lambda 通过私有网络访问数据库，更安全。

## 架构图

```
公网
  │
  ▼
API Gateway
  │
  ▼
Lambda（公有子网 / 私有子网 + NAT）
  │  ← 私有网络，不经过公网
  ▼
RDS（私有子网，不对外暴露）
```

## 每一步在做什么

```
步骤 1：创建 VPC          →  划出一块独立的私有网络空间
步骤 2：创建子网          →  把 VPC 切成公有子网和私有子网
步骤 3：创建网关          →  公有子网连公网（IGW），私有子网出公网（NAT）
步骤 4：配置路由表        →  告诉流量该往哪走
步骤 5：给 IAM Role 加权限 →  Lambda 在 VPC 里运行需要额外权限
步骤 6：创建安全组        →  资源级别的防火墙，控制谁能访问谁
步骤 7：创建 RDS          →  放进私有子网，挂 RDS 安全组
步骤 8：Lambda 加入 VPC   →  放进私有子网，挂 Lambda 安全组
步骤 9：推送表结构        →  从本地连 RDS 初始化表
步骤 10：设置环境变量     →  更新 Lambda 的 DATABASE_URL
```

---

## 完整部署步骤

### 步骤 1：创建 VPC

VPC 是你在 AWS 里的私有网络，所有资源都在里面。

```bash
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region ap-southeast-1 \
  --query 'Vpc.VpcId' --output text
```

参数拆解：
- `--cidr-block 10.0.0.0/16`：这个 VPC 的 IP 地址范围，`/16` 表示有 65536 个可用 IP
- 记下输出的 `VpcId`，后面所有步骤都要用

给 VPC 打个名字方便识别：
```bash
aws ec2 create-tags \
  --resources <VpcId> \
  --tags Key=Name,Value=better-t-stack-vpc \
  --region ap-southeast-1
```

---

### 步骤 2：创建子网

需要创建两种子网：
- **公有子网**：Lambda 放这里（需要访问外网调用 GitHub API 等）
- **私有子网**：RDS 放这里（不需要对外暴露）

RDS 要求至少两个不同可用区的子网才能创建子网组，所以私有子网建两个。

```bash
# 公有子网（Lambda 用）- 可用区 a
aws ec2 create-subnet \
  --vpc-id <VpcId> \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-southeast-1a \
  --region ap-southeast-1 \
  --query 'Subnet.SubnetId' --output text

# 私有子网 1（RDS 用）- 可用区 a
aws ec2 create-subnet \
  --vpc-id <VpcId> \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-southeast-1a \
  --region ap-southeast-1 \
  --query 'Subnet.SubnetId' --output text

# 私有子网 2（RDS 用）- 可用区 b（RDS 子网组要求多个可用区）
aws ec2 create-subnet \
  --vpc-id <VpcId> \
  --cidr-block 10.0.3.0/24 \
  --availability-zone ap-southeast-1b \
  --region ap-southeast-1 \
  --query 'Subnet.SubnetId' --output text
```

记下三个 SubnetId：`<PublicSubnetId>`、`<PrivateSubnetId1>`、`<PrivateSubnetId2>`

---

### 步骤 3：创建网关

**Internet Gateway（IGW）**：让公有子网里的资源能访问公网。

```bash
# 创建 IGW
aws ec2 create-internet-gateway \
  --region ap-southeast-1 \
  --query 'InternetGateway.InternetGatewayId' --output text

# 把 IGW 挂到 VPC 上
aws ec2 attach-internet-gateway \
  --internet-gateway-id <IgwId> \
  --vpc-id <VpcId> \
  --region ap-southeast-1
```

**NAT Gateway**：让私有子网里的资源能主动访问公网（但外网不能主动连进来）。Lambda 放在私有子网时需要 NAT 才能访问 GitHub API 等外部服务。

```bash
# 先申请一个弹性 IP（NAT Gateway 需要固定公网 IP）
aws ec2 allocate-address \
  --domain vpc \
  --region ap-southeast-1 \
  --query 'AllocationId' --output text

# 在公有子网里创建 NAT Gateway（NAT 本身要放在公有子网）
aws ec2 create-nat-gateway \
  --subnet-id <PublicSubnetId> \
  --allocation-id <EipAllocationId> \
  --region ap-southeast-1 \
  --query 'NatGateway.NatGatewayId' --output text

# 等待 NAT Gateway 变成 available 状态（约 1 分钟）
aws ec2 wait nat-gateway-available \
  --nat-gateway-ids <NatGatewayId> \
  --region ap-southeast-1
```

注意：NAT Gateway 按小时收费（约 $0.045/小时），不用时可以删掉。

---

### 步骤 4：配置路由表

路由表告诉子网里的流量该往哪走。

**公有子网路由表**（流量走 IGW 出公网）：

```bash
# 创建路由表
aws ec2 create-route-table \
  --vpc-id <VpcId> \
  --region ap-southeast-1 \
  --query 'RouteTable.RouteTableId' --output text

# 添加默认路由：所有流量走 IGW
aws ec2 create-route \
  --route-table-id <PublicRtId> \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id <IgwId> \
  --region ap-southeast-1

# 把公有子网关联到这个路由表
aws ec2 associate-route-table \
  --route-table-id <PublicRtId> \
  --subnet-id <PublicSubnetId> \
  --region ap-southeast-1
```

**私有子网路由表**（流量走 NAT Gateway 出公网）：

```bash
# 创建路由表
aws ec2 create-route-table \
  --vpc-id <VpcId> \
  --region ap-southeast-1 \
  --query 'RouteTable.RouteTableId' --output text

# 添加默认路由：所有流量走 NAT Gateway
aws ec2 create-route \
  --route-table-id <PrivateRtId> \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id <NatGatewayId> \
  --region ap-southeast-1

# 把两个私有子网都关联到这个路由表
aws ec2 associate-route-table \
  --route-table-id <PrivateRtId> \
  --subnet-id <PrivateSubnetId1> \
  --region ap-southeast-1

aws ec2 associate-route-table \
  --route-table-id <PrivateRtId> \
  --subnet-id <PrivateSubnetId2> \
  --region ap-southeast-1
```

---

### 步骤 5：给 IAM Role 加 VPC 权限

Lambda 在 VPC 里运行需要额外权限（创建和删除网络接口）。

```bash
aws iam attach-role-policy \
  --role-name better-t-stack-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
```

参数拆解：
- `AWSLambdaVPCAccessExecutionRole`：AWS 托管策略，包含 `ec2:CreateNetworkInterface`、`ec2:DescribeNetworkInterfaces`、`ec2:DeleteNetworkInterface` 权限
- 不加这个权限，Lambda 加入 VPC 时会报 `EC2 Error: not authorized`

---

### 步骤 6：创建安全组

安全组是资源级别的防火墙，每个资源可以挂多个安全组。

**Lambda 安全组**（允许所有出站，Lambda 需要访问 RDS 和外网）：

```bash
aws ec2 create-security-group \
  --group-name better-t-stack-lambda-sg \
  --description "Lambda security group" \
  --vpc-id <VpcId> \
  --region ap-southeast-1 \
  --query 'GroupId' --output text
```

参数拆解：
- `--group-name`：安全组名称，同一个 VPC 内不能重复
- `--description`：必填，说明这个安全组的用途
- 默认出站规则是允许所有流量，不需要额外添加

**RDS 安全组**（只允许来自 Lambda 安全组的 5432 端口）：

```bash
# 创建安全组
aws ec2 create-security-group \
  --group-name better-t-stack-rds-sg \
  --description "RDS security group, only allow Lambda" \
  --vpc-id <VpcId> \
  --region ap-southeast-1 \
  --query 'GroupId' --output text

# 添加入站规则：只允许来自 Lambda 安全组的 5432 端口
aws ec2 authorize-security-group-ingress \
  --group-id <RdsSgId> \
  --protocol tcp \
  --port 5432 \
  --source-group <LambdaSgId> \
  --region ap-southeast-1
```

参数拆解：
- `--source-group <LambdaSgId>`：来源是另一个安全组，不是 IP 地址。意思是：只有挂了 Lambda 安全组的资源才能访问这个端口
- 这比用 IP 地址限制更安全，因为 Lambda 的 IP 是动态变化的

---

### 步骤 7：创建 RDS（放进私有子网）

```bash
# 创建子网组（告诉 RDS 可以用哪些子网）
aws rds create-db-subnet-group \
  --db-subnet-group-name better-t-stack-subnet-group \
  --db-subnet-group-description "better-t-stack RDS subnet group" \
  --subnet-ids <PrivateSubnetId1> <PrivateSubnetId2> \
  --region ap-southeast-1

# 创建 RDS 实例
aws rds create-db-instance \
  --db-instance-identifier better-t-stack-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password <你的密码> \
  --db-name bettertstack \
  --db-subnet-group-name better-t-stack-subnet-group \
  --vpc-security-group-ids <RdsSgId> \
  --no-publicly-accessible \
  --allocated-storage 20 \
  --no-multi-az \
  --region ap-southeast-1

# 等待创建完成（约 5-10 分钟）
aws rds wait db-instance-available \
  --db-instance-identifier better-t-stack-db \
  --region ap-southeast-1

# 获取 RDS 地址
aws rds describe-db-instances \
  --db-instance-identifier better-t-stack-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --region ap-southeast-1
```

注意：这里用 `--no-publicly-accessible`，RDS 不对外暴露，只能从 VPC 内部访问。

---

### 步骤 8：Lambda 加入 VPC

把已有的 Lambda 函数配置到 VPC 里，放进私有子网。

```bash
aws lambda update-function-configuration \
  --function-name better-t-stack-api \
  --vpc-config SubnetIds=<PrivateSubnetId1>,<PrivateSubnetId2>,SecurityGroupIds=<LambdaSgId> \
  --region ap-southeast-1
```

参数拆解：
- `SubnetIds`：Lambda 放进哪些子网（多个子网提高可用性）
- `SecurityGroupIds`：挂哪个安全组（控制 Lambda 能访问什么）

等待配置更新完成：
```bash
aws lambda wait function-updated \
  --function-name better-t-stack-api \
  --region ap-southeast-1
```

---

### 步骤 9：推送表结构到 RDS

RDS 在私有子网里，本地无法直接连接。需要临时把 RDS 安全组开放本地 IP，推完再关掉。

```bash
# 查询本地公网 IP
curl -s https://checkip.amazonaws.com

# 临时开放本地 IP 访问 RDS 的 5432 端口
aws ec2 authorize-security-group-ingress \
  --group-id <RdsSgId> \
  --protocol tcp \
  --port 5432 \
  --cidr <本地IP>/32 \
  --region ap-southeast-1

# 推送表结构
cd packages/db
DATABASE_URL="postgresql://postgres:<密码>@<RDS地址>:5432/bettertstack?sslmode=no-verify" npx drizzle-kit push

# 推完后撤销临时规则
aws ec2 revoke-security-group-ingress \
  --group-id <RdsSgId> \
  --protocol tcp \
  --port 5432 \
  --cidr <本地IP>/32 \
  --region ap-southeast-1
```

---

### 步骤 10：更新 Lambda 环境变量

```bash
aws lambda update-function-configuration \
  --function-name better-t-stack-api \
  --environment "Variables={DATABASE_URL=postgresql://postgres:<密码>@<RDS地址>:5432/bettertstack?sslmode=no-verify,CORS_ORIGIN=<前端地址>,NODE_ENV=production}" \
  --region ap-southeast-1
```

---

## 验证部署

```bash
# 健康检查
curl https://<ApiId>.execute-api.ap-southeast-1.amazonaws.com/trpc/healthCheck

# 查看 Lambda 日志（如果有问题）
aws logs filter-log-events \
  --log-group-name /aws/lambda/better-t-stack-api \
  --region ap-southeast-1 \
  --start-time $(date -v-5m +%s000) \
  --query 'events[*].message' \
  --output text
```

---

## 踩坑记录

### 坑 1：Lambda 加入 VPC 后无法访问外网

**现象**：Lambda 调用 GitHub API 超时，但连 RDS 正常

**原因**：Lambda 放进私有子网后，出公网的流量需要经过 NAT Gateway。如果没有 NAT，或者路由表没配对，Lambda 就无法访问外网。

**解决**：确认私有子网的路由表有一条 `0.0.0.0/0 → NAT Gateway` 的路由。

---

### 坑 2：Lambda 加入 VPC 时报权限错误

**现象**：
```
EC2 Error: User is not authorized to perform: ec2:CreateNetworkInterface
```

**原因**：Lambda 的 IAM Role 没有 VPC 相关权限。

**解决**：执行步骤 5，给 Role 附加 `AWSLambdaVPCAccessExecutionRole` 策略。

---

### 坑 3：本地无法连接私有子网里的 RDS

**现象**：`npx drizzle-kit push` 连接超时

**原因**：RDS 在私有子网，`--no-publicly-accessible`，本地无法直接连。

**解决**：按步骤 9，临时给 RDS 安全组加本地 IP 的入站规则，推完立即撤销。

---

### 坑 4：Lambda 冷启动变慢

**现象**：加入 VPC 后 Lambda 第一次调用明显变慢（可能超过 10 秒）

**原因**：Lambda 加入 VPC 后，冷启动时需要创建网络接口（ENI），这个过程比较慢。

**解决**：这是 VPC Lambda 的已知问题，可以通过设置 Provisioned Concurrency 缓解，但会增加费用。开发阶段可以接受。
