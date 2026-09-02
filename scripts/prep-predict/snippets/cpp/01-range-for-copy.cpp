#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> values{1, 2, 3};
    for (int v : values) v *= 10;
    for (int v : values) cout << v << " ";
    cout << "\n";
    for (int& v : values) v *= 10;
    for (int v : values) cout << v << " ";
    cout << "\n";
    return 0;
}
