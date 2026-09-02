public class J10 {
    static StringBuilder order = new StringBuilder();
    static { order.append("static-1 "); }
    int instanceField = record("field ");
    { order.append("init-block "); }
    J10() { order.append("ctor "); }
    static { order.append("static-2 "); }

    static int record(String label) { order.append(label); return 0; }

    public static void main(String[] args) {
        order.append("main ");
        new J10();
        System.out.println(order.toString().trim());
    }
}
