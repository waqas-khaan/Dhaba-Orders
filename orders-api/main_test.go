package main
import ("net/http/httptest"; "testing")
func TestJSONOut(t *testing.T) {
 rr:=httptest.NewRecorder()
 jsonOut(rr,200,map[string]string{"ok":"yes"})
 if rr.Code!=200 { t.Fatalf("want 200 got %d",rr.Code) }
}
