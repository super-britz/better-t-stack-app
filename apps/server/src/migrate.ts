import { runMigrations } from "@better-t-stack-app/db/migrate";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const handler = async (event: any) => {
  console.log("Migration event:", JSON.stringify(event, null, 2));

  if (event.RequestType === "Delete") {
    await sendResponse(event, "SUCCESS");
    return;
  }

  try {
    await runMigrations(
      process.env.DATABASE_URL!,
      path.join(__dirname, "migrations"),
    );
    console.log("Migration successful");
    await sendResponse(event, "SUCCESS");
  } catch (error) {
    console.error("Migration failed:", error);
    // 迁移失败仍然必须回调 CloudFormation，否则栈会卡住直到超时
    await sendResponse(event, "FAILED", String(error));
  }
};

async function sendResponse(event: any, status: string, reason = "") {
  const body = JSON.stringify({
    Status: status,
    Reason: reason.slice(0, 4000), // CloudFormation 限制 reason 长度
    PhysicalResourceId: "db-migration",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  });

  try {
    // CloudFormation 要求 Content-Type 为空字符串
    const res = await fetch(event.ResponseURL, {
      method: "PUT",
      body,
      headers: { "Content-Type": "" },
    });
    console.log(`CloudFormation 回调完成: status=${status}, httpCode=${res.status}`);
  } catch (error) {
    // 回调失败是致命问题——栈会卡住直到 Lambda 超时
    console.error("CloudFormation 回调失败，栈将卡住直到超时:", error);
    throw error;
  }
}
