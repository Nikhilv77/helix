import java.util.*;

public class J09 {
    public static void main(String[] args) {
        List<Integer> values = new ArrayList<>(List.of(10, 20, 30));
        values.remove(1);
        System.out.println(values);
        values.remove(Integer.valueOf(30));
        System.out.println(values);
        System.out.println(values.size());
    }
}
