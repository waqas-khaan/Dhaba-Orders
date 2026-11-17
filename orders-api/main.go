package main

import (
 "context"
 "database/sql"
 "encoding/json"
 "log"
 "net/http"
 "os"
 "strconv"
 "time"

 _ "github.com/lib/pq"
 "github.com/redis/go-redis/v9"
)

type Item struct { DishID int `json:"dish_id"`; Quantity int `json:"quantity"` }
type OrderRequest struct { Items []Item `json:"items"` }
type OrderResponse struct { ID int64 `json:"id"`; Status string `json:"status"`; Total float64 `json:"total"` }
var db *sql.DB
var rdb *redis.Client
var version = "dev"

func jsonOut(w http.ResponseWriter, status int, v any) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(status); _ = json.NewEncoder(w).Encode(v) }
func health(w http.ResponseWriter, r *http.Request) {
 ctx,cancel:=context.WithTimeout(r.Context(),2*time.Second); defer cancel()
 if err:=db.PingContext(ctx); err!=nil { jsonOut(w,503,map[string]string{"status":"down"}); return }
 if err:=rdb.Ping(ctx).Err(); err!=nil { jsonOut(w,503,map[string]string{"status":"down"}); return }
 jsonOut(w,200,map[string]string{"status":"ok"})
}
func createOrder(w http.ResponseWriter, r *http.Request) {
 if r.Method!="POST" { jsonOut(w,405,map[string]string{"error":"method not allowed"}); return }
 var req OrderRequest
 if err:=json.NewDecoder(r.Body).Decode(&req); err!=nil || len(req.Items)==0 { jsonOut(w,400,map[string]string{"error":"items are required"}); return }
 tx,err:=db.BeginTx(r.Context(),nil); if err!=nil { jsonOut(w,500,map[string]string{"error":err.Error()}); return }; defer tx.Rollback()
 var total float64
 type line struct { id int; name string; qty int; price float64 }
 lines:=[]line{}
 for _,it:=range req.Items {
  if it.Quantity<1 { jsonOut(w,400,map[string]string{"error":"quantity must be positive"}); return }
  var name string; var price float64
  err=tx.QueryRowContext(r.Context(),"SELECT name,price FROM menu_items WHERE id=$1 AND available=true",it.DishID).Scan(&name,&price)
  if err!=nil { jsonOut(w,400,map[string]string{"error":"unknown dish"}); return }
  total+=price*float64(it.Quantity); lines=append(lines,line{it.DishID,name,it.Quantity,price})
 }
 var id int64
 if err=tx.QueryRowContext(r.Context(),"INSERT INTO orders(status,total) VALUES('new',$1) RETURNING id",total).Scan(&id); err!=nil { jsonOut(w,500,map[string]string{"error":err.Error()}); return }
 for _,l:=range lines { _,err=tx.ExecContext(r.Context(),"INSERT INTO order_items(order_id,dish_id,dish_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)",id,l.id,l.name,l.qty,l.price); if err!=nil { jsonOut(w,500,map[string]string{"error":err.Error()}); return } }
 if err=tx.Commit(); err!=nil { jsonOut(w,500,map[string]string{"error":err.Error()}); return }
 payload,_:=json.Marshal(map[string]any{"order_id":id})
 if err=rdb.LPush(r.Context(),"orders:queue",payload).Err(); err!=nil { log.Printf("queue push failed for order %d: %v",id,err) }
 jsonOut(w,201,OrderResponse{id,"new",total})
}
func getOrder(w http.ResponseWriter,r *http.Request) {
 id:=r.URL.Path[len("/orders/"):]
 var status string; var total float64
 n,err:=strconv.ParseInt(id,10,64); if err!=nil { jsonOut(w,400,map[string]string{"error":"invalid id"}); return }
 err=db.QueryRowContext(r.Context(),"SELECT status,total FROM orders WHERE id=$1",n).Scan(&status,&total)
 if err==sql.ErrNoRows { jsonOut(w,404,map[string]string{"error":"not found"}); return }; if err!=nil { jsonOut(w,500,map[string]string{"error":err.Error()}); return }
 jsonOut(w,200,OrderResponse{n,status,total})
}
func main() {
 version=os.Getenv("APP_VERSION")
 dsn:=os.Getenv("DATABASE_URL"); if dsn=="" { dsn="postgres://dhaba:local_dev_password@localhost:5432/dhaba?sslmode=disable" }
 var err error; db,err=sql.Open("postgres",dsn); if err!=nil { log.Fatal(err) }; db.SetMaxOpenConns(10)
 addr:=os.Getenv("REDIS_ADDR"); if addr=="" { addr="localhost:6379" }; rdb=redis.NewClient(&redis.Options{Addr:addr})
 http.HandleFunc("/health",health)
 http.HandleFunc("/info",func(w http.ResponseWriter,r *http.Request){ jsonOut(w,200,map[string]string{"service":"orders-api","version":version,"pod":os.Getenv("HOSTNAME")}) })
 http.HandleFunc("/orders",createOrder)
 http.HandleFunc("/orders/",getOrder)
 log.Fatal(http.ListenAndServe(":8080",nil))
}
