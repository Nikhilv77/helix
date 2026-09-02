public class J03 {
    static String describe(Object value) { return "Object"; }
    static String describe(String value) { return "String"; }

    public static void main(String[] args) {
        System.out.println(describe("text"));
        System.out.println(describe(42));
        System.out.println(describe((Object) "text"));
        System.out.println(describe(null));
        Object held = "text";
        System.out.println(describe(held));
    }
}
