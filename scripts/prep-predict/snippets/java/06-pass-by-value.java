public class J06 {
    static void reassign(int[] values) { values = new int[]{9, 9}; }
    static void mutate(int[] values) { values[0] = 9; }
    static void grow(StringBuilder text) { text.append("!"); }
    static void replace(String text) { text = text + "!"; }

    public static void main(String[] args) {
        int[] numbers = {1, 2};
        reassign(numbers);
        System.out.println(numbers[0]);
        mutate(numbers);
        System.out.println(numbers[0]);
        StringBuilder builder = new StringBuilder("hi");
        grow(builder);
        System.out.println(builder);
        String text = "hi";
        replace(text);
        System.out.println(text);
    }
}
