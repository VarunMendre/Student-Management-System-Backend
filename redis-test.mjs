import { createClient } from "redis";

async function testRedis() {
  const client = createClient({
    path: process.env.REDIS_SOCKET,
  });

  
  await client.connect();
  
  await client.set("myTestKey", "Hello Varun");
  console.log("Key stored successfully!");
  
  const value = await client.get("myTestKey");
  console.log("Fetched value:", value);
  
    client.on("error", (err) => { 
        
        console.log("Redis Error:", err);
        await client.quit();
});
  await client.quit();
}

testRedis();