# AWS 核心概念速查

## 计算资源

| 缩写 | 全称 | 作用 | 为什么需要它 |
|------|------|------|-------------|
| EC2 | Elastic Compute Cloud | 虚拟服务器，完全自己管理操作系统、运行时、部署 | 需要完全控制服务器环境，或运行长期稳定的服务 |
| Lambda | - | 函数即服务，按调用次数收费，单次最长15分钟 | 流量不稳定或极小时，不用为空闲时间付费 |
| 容器 | - | 把代码和运行环境打包在一起 | 解决"在我机器上能跑"的环境一致性问题 |
| Docker | - | 容器的打包工具和运行时 | 构建、分发、运行容器的标准工具 |
| ECS | Elastic Container Service | AWS 的容器编排服务，管理容器的启停、扩缩容、调度 | 手动管理多个容器实例太复杂，需要自动化 |
| Fargate | - | 无服务器容器运行环境，不用管底层 EC2 | 想跑容器但不想维护服务器 |
| EKS | Elastic Kubernetes Service | AWS 托管的 Kubernetes 集群 | 团队已熟悉 Kubernetes，或需要多云/复杂编排 |

---

## 网络

| 缩写 | 全称 | 作用 | 为什么需要它 |
|------|------|------|-------------|
| IPv4 | Internet Protocol version 4 | 32位网络地址，格式如 `192.168.1.1` | 互联网设备寻址的基础协议，目前仍是主流 |
| IPv6 | Internet Protocol version 6 | 128位网络地址，格式如 `2001:db8::1` | IPv4 地址已耗尽，IPv6 提供几乎无限的地址空间 |
| CIDR | Classless Inter-Domain Routing | 用 `/数字` 表示子网掩码，如 `10.0.0.0/16` | 比子网掩码更简洁地表达网络范围 |
| NAT | Network Address Translation | 把私有 IP 替换成公网 IP 发出请求，返回时再替换回来 | 让私有网络内的设备能访问公网，同时节省公网 IP |
| VPC | Virtual Private Cloud | AWS 上的私有网络空间，资源默认对公网不可见 | 隔离资源，防止数据库等敏感资源暴露在公网 |
| 子网 | Subnet | VPC 内细分的网段，必须绑定一个可用区 | VPC 只是地址范围声明，资源必须放在子网里才能运行 |
| 路由表 | Route Table | 定义网络包该往哪里发，格式为"目标地址段 → 下一跳" | 控制子网是公有还是私有的关键，没有路由表流量不知道往哪走 |
| 安全组 | Security Group | 资源级别的有状态防火墙，只需配入站规则，响应流量自动放行 | 精细控制每个资源的网络访问权限 |
| NACL | Network Access Control List | 子网级别的无状态防火墙，入站出站规则都要配，按编号顺序匹配 | 需要封锁整个子网的某段 IP 时使用，比如遭受 DDoS 时快速封禁来源 |
| IGW | Internet Gateway | VPC 连接公网的出入口 | 没有 IGW，VPC 内的资源完全无法访问公网 |
| NAT Gateway | Network Address Translation Gateway | 让私有子网的资源能主动访问公网，但公网不能主动进来 | 私有子网需要访问外部 API 或下载依赖，同时保持不可被公网访问 |
| ALB | Application Load Balancer | 把流量分发到多个后端实例，支持按路径/域名路由 | 单个实例扛不住流量时，水平扩展并自动剔除故障实例 |
| API Gateway | - | HTTP 入口，统一处理路由、认证、限流、日志、HTTPS | 避免每个后端服务重复实现这些通用功能，同时保护后端不直接暴露公网 |
| VPN | Virtual Private Network | 在公网上建立加密隧道，连接本地网络和 AWS VPC | 公司员工或本地机房需要安全访问 AWS 内网资源 |
| Direct Connect | AWS Direct Connect | 本地机房和 AWS 之间的专用物理线路，不走公网 | 需要稳定低延迟或大量数据传输，VPN 的公网波动无法满足要求 |

---

## 存储和数据库

| 缩写 | 全称 | 作用 | 为什么需要它 |
|------|------|------|-------------|
| S3 | Simple Storage Service | 对象存储，存任意文件，按用量付费 | 存图片、视频、备份、静态网站等，比 EC2 磁盘便宜且高可用 |
| RDS | Relational Database Service | 托管关系型数据库（MySQL/PostgreSQL等） | 不用自己管数据库的备份、升级、高可用 |
| DynamoDB | - | AWS 的无服务器 NoSQL 数据库 | 天生适配 Lambda，无连接池问题，按用量付费 |
| ElastiCache | - | 托管 Redis/Memcached 缓存服务 | 把热点数据放内存，减少数据库压力，降低响应延迟 |

---

## 权限和安全

| 缩写 | 全称 | 作用 | 为什么需要它 |
|------|------|------|-------------|
| IAM | Identity and Access Management | 管理谁能访问 AWS 的什么资源 | 最小权限原则，防止误操作或泄露导致资源被滥用 |
| ARN | Amazon Resource Name | AWS 资源的全局唯一标识符，格式如 `arn:aws:s3:::my-bucket` | 在 Policy、日志、跨账号授权中精确指定某个资源 |
| IAM Role | IAM Role | 给 AWS 服务用的权限身份，不需要用户名密码 | Lambda、EC2 等服务需要访问其他 AWS 资源时，通过 Role 授权而不是硬编码密钥 |
| IAM Policy | IAM Policy | JSON 格式的权限规则文档，定义允许/拒绝哪些操作 | 把权限规则和身份分离，可以复用同一份 Policy 给多个 Role/User |

---

## 基础设施概念

| 缩写 | 全称 | 作用 | 为什么需要它 |
|------|------|------|-------------|
| AMI | Amazon Machine Image | EC2 的系统镜像模板，包含操作系统和预装软件 | 快速启动预配置好的服务器，不用每次从零安装系统 |
| AZ | Availability Zone（可用区） | 同一地区内物理隔离的独立数据中心 | 一个 AZ 故障不影响其他 AZ，实现高可用 |
| Region | - | 地理上独立的 AWS 数据中心集群，如 `ap-southeast-1`（新加坡） | 选择离用户近的 Region 降低延迟，或满足数据合规要求 |

---

## 概念关系图

```
Region（地区）
└── VPC（私有网络）
    ├── 公有子网（AZ-a）         ← IGW 连接公网
    │   └── ALB / NAT Gateway
    ├── 公有子网（AZ-b）
    ├── 私有子网（AZ-a）         ← 只能通过 NAT Gateway 出去
    │   ├── Lambda / Fargate
    │   └── RDS
    └── 私有子网（AZ-b）
            └── RDS（备用）

流量控制两层：
  NACL     → 子网边界，无状态，封整段 IP
  安全组    → 资源边界，有状态，精细控制端口和来源

本地机房连接 AWS：
  VPN          → 走公网加密隧道，便宜，适合小流量
  Direct Connect → 专用物理线路，稳定，适合大流量

IAM Role → 授权 Lambda 访问 RDS / S3 / 其他服务
路由表   → 决定子网是公有还是私有
API Gateway → 公网唯一入口 → Lambda
```
