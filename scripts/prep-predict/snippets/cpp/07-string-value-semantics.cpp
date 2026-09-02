#include <iostream>
#include <string>
using namespace std;

int main() {
    string a = "abc";
    string b = a;
    b[0] = 'x';
    cout << a << " " << b << "\n";
    cout << a.substr(1) << "\n";
    cout << a.size() << " " << string("").size() << "\n";
    cout << (a < "abd") << "\n";
    cout << (string("10") < string("9")) << "\n";
    return 0;
}
