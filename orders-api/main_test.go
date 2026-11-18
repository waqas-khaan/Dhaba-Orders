package main
import (
	"net/http/httptest"
	"testing"
)
func TestJSONOut(t *testing.T) {
	rr:=httptest.NewRecorder()
	jsonOut(rr,200,map[string]string{"ok":"yes"})
	if rr.Code!=200 { t.Fatalf("want 200 got %d",rr.Code) }
}
func TestListOrdersEmptyDB(t *testing.T) {
	req := httptest.NewRequest("GET", "/orders", nil)
	rr := httptest.NewRecorder()
	listOrders(rr, req)
	if rr.Code != 200 {
		t.Fatalf("want 200 got %d", rr.Code)
	}
}
