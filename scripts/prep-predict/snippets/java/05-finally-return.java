public class J05 {
    static int attempt() {
        int value = 1;
        try {
            return value;
        } finally {
            value = 2;
        }
    }
    static StringBuilder build() {
        StringBuilder text = new StringBuilder("a");
        try {
            return text;
        } finally {
            text.append("b");
        }
    }

    public static void main(String[] args) {
        System.out.println(attempt());
        System.out.println(build());
    }
}
