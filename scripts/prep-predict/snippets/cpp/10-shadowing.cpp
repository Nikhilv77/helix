#include <iostream>
using namespace std;

int shadow = 1;

int main() {
    cout << shadow << "\n";
    int shadow = 2;
    cout << shadow << "\n";
    {
        int shadow = 3;
        cout << shadow << "\n";
    }
    cout << shadow << "\n";
    cout << ::shadow << "\n";
    return 0;
}
