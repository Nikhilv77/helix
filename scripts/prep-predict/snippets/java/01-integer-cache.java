public class J01 {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        System.out.println(a == b);
        Integer c = 128, d = 128;
        System.out.println(c == d);
        System.out.println(c.equals(d));
        int e = 128;
        System.out.println(c == e);
    }
}
