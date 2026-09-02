public class J04 {
    static class Parent {
        String name = "parent";
        String who() { return "Parent"; }
    }
    static class Child extends Parent {
        String name = "child";
        String who() { return "Child"; }
    }

    public static void main(String[] args) {
        Parent value = new Child();
        System.out.println(value.name);
        System.out.println(value.who());
        System.out.println(((Child) value).name);
    }
}
