package com.dhaba;

import java.time.Instant;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootApplication
@EnableScheduling
public class KitchenWorkerApplication {
 public static void main(String[] args) { SpringApplication.run(KitchenWorkerApplication.class,args); }
 @Bean RedisConnectionFactory redisConnectionFactory() {
  String host=System.getenv().getOrDefault("REDIS_HOST","localhost");
  int port=Integer.parseInt(System.getenv().getOrDefault("REDIS_PORT","6379"));
  return new LettuceConnectionFactory(host,port);
 }
 @Bean StringRedisTemplate redisTemplate(RedisConnectionFactory f) { return new StringRedisTemplate(f); }
 @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
}

@Component
class OrderProcessor {
 private final StringRedisTemplate redis;
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 OrderProcessor(StringRedisTemplate redis, JdbcTemplate jdbc, ObjectMapper mapper) {
  this.redis=redis; this.jdbc=jdbc; this.mapper=mapper;
 }
 @Scheduled(fixedDelay=1000)
 public void processNext() {
  String raw=redis.opsForList().rightPop("orders:queue");
  if(raw==null) return;
  try {
   Map<?,?> event=mapper.readValue(raw,Map.class);
   long id=((Number)event.get("order_id")).longValue();
   jdbc.update("UPDATE orders SET status='cooking' WHERE id=?",id);
   Thread.sleep(700);
   jdbc.update("UPDATE orders SET status='ready' WHERE id=?",id);
  } catch(Exception ex) { System.err.println("Order processing failed: "+ex.getMessage()); }
 }
 @Scheduled(fixedRate=10000)
 public void heartbeat() {
  redis.opsForValue().set("worker:heartbeat",Instant.now().toString());
 }
}
