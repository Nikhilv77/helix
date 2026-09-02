/**
 * Teaching metadata for the `predict-run` banks.
 *
 * The code and the expected output are **not** here — they come from the files
 * in `snippets/`, executed by `build.mjs`. Nobody writes an expected output by
 * hand; the same rule the DSA case generator follows, for the same reason.
 *
 * `chapterKey` is set explicitly rather than derived. `prepChapterKey` in the
 * seed maps every `javascript-*` competency to one chapter, so the ten
 * JavaScript questions share a single chapter — and placement round-robins
 * across chapters, meaning a language's share of a session is decided by how
 * many chapters it spans. One chapter per language keeps the four even.
 */

const SHARED = {
  contentVersion: 1,
  roles: ["backend", "fullstack", "frontend"],
  levels: ["fresher", "0-2", "3-5"],
  evidenceType: "fundamental",
  format: "predict-run",
  expectedMinutes: 4,
  prerequisites: [],
  prompt:
    "Read the code and predict exactly what it prints, in order. Write one line per line of output.",
  answerStructure: {
    framework: "Read → Simulate → Commit",
    steps: [
      "Walk each statement in order",
      "Track what each name refers to after every step",
      "Write the printed lines in order"
    ]
  },
  scoringRubric: {
    strong: "Predicted every line in the correct order.",
    developing: "Right values, wrong order, or one line missed.",
    weak: "Missed the mechanism the snippet turns on."
  }
};

const question = (language, chapterKey, category, index, file, fields) => ({
  ...SHARED,
  id: `predict-run-${language}-${String(index).padStart(2, "0")}`,
  language,
  file,
  chapterKey,
  category,
  competency: chapterKey,
  ...fields
});

export const PYTHON = [
  question("py", "python-runtime", "backend", 1, "01-mutable-default.py", {
    title: "The default argument that remembers",
    difficulty: "medium",
    objective: "Explain when a default argument value is created and how long it lives.",
    explanation:
      "A default value is evaluated once, when the function is defined — not on each call. The list in the signature is therefore one object shared by every call that does not pass its own. Passing an explicit list bypasses it, and the shared list still holds what earlier calls put there.",
    hints: [
      "When is the expression in the signature evaluated?",
      "How many list objects exist in this program?"
    ],
    tags: ["python", "functions", "mutability"],
    whatItTests: ["default argument evaluation", "shared mutable state", "object identity"],
    goodAnswerSignals: ["Says the default is created once at definition", "Tracks the shared list across calls"],
    weakAnswerSignals: ["Assumes a fresh list on every call", "Treats the explicit argument as resetting the default"],
    followUpPrompts: ["How would you write this so each call starts empty?"],
    mayaPushbacks: ["Why does passing your own list not reset the default?"]
  }),
  question("py", "python-runtime", "backend", 2, "02-late-binding.py", {
    title: "Closures that all agree",
    difficulty: "medium",
    objective: "Explain what a closure captures — the variable or its value.",
    explanation:
      "A closure captures the variable, not the value it had when the closure was made. All three lambdas refer to the same `i`, and by the time any of them runs the loop has finished, so they all see its final value. A default argument is evaluated at definition time, which is why the second version captures each value separately.",
    hints: ["What does the lambda hold a reference to?", "When does the lambda body actually run?"],
    tags: ["python", "closures", "scope"],
    whatItTests: ["late binding", "closure capture", "default argument evaluation"],
    goodAnswerSignals: ["Says the closure captures the variable", "Explains why the default-argument version differs"],
    weakAnswerSignals: ["Expects each closure to remember its own loop value"],
    followUpPrompts: ["Which of these two would you use in review, and why?"],
    mayaPushbacks: ["The loop clearly ran three times — why is the answer not 0, 1, 2?"]
  }),
  question("py", "python-runtime", "backend", 3, "03-list-aliasing.py", {
    title: "Three rows, one list",
    difficulty: "easy",
    objective: "Distinguish repeating a reference from creating separate objects.",
    explanation:
      "Multiplying a list repeats the reference, not the contents, so all three rows are the same inner list and writing through one writes through all. The comprehension evaluates its expression once per iteration, producing three distinct lists.",
    hints: ["How many inner lists does the multiplication create?", "What does the comprehension re-evaluate?"],
    tags: ["python", "lists", "aliasing"],
    whatItTests: ["reference semantics", "list multiplication", "grid construction"],
    goodAnswerSignals: ["Identifies the rows as one shared object", "Contrasts with the comprehension"],
    weakAnswerSignals: ["Treats list multiplication as a deep copy"],
    followUpPrompts: ["How would you spot this bug from the symptom alone?"],
    mayaPushbacks: ["Only one row was assigned — why did the others change?"]
  }),
  question("py", "python-runtime", "backend", 4, "04-bool-is-int.py", {
    title: "True is a number",
    difficulty: "medium",
    objective: "Explain how bool relates to int, and what that means for dict and set keys.",
    explanation:
      "`bool` is a subclass of `int`: True equals 1 and hashes like it. So a dict literal with both keys keeps one entry — the later value wins while the first key object stays — and a set of 1, True and 1.0 collapses to a single element. Chained comparison and numeric equality across int and float follow the same value-based rules.",
    hints: ["What is True equal to?", "What decides whether two dict keys are the same key?"],
    tags: ["python", "data-model", "equality"],
    whatItTests: ["bool as int", "hash and equality", "dict and set key collapsing"],
    goodAnswerSignals: ["Says True == 1 and hashes identically", "Explains which value survives in the dict"],
    weakAnswerSignals: ["Expects separate entries for True and 1"],
    followUpPrompts: ["Where could this bite in a counter keyed by user input?"],
    mayaPushbacks: ["The dict literal has two keys written — why does it print one?"]
  }),
  question("py", "python-runtime", "backend", 5, "05-try-else-finally.py", {
    title: "else, except, finally",
    difficulty: "easy",
    objective: "Order the four blocks of a try statement correctly.",
    explanation:
      "`else` runs only when the `try` block raised nothing; `except` runs only when it did. `finally` runs either way, last. The short list raises IndexError so the except path runs; the long list does not, so the else path runs.",
    hints: ["Which block runs when nothing was raised?", "Which block always runs?"],
    tags: ["python", "exceptions", "control-flow"],
    whatItTests: ["try/except/else/finally ordering", "exception paths"],
    goodAnswerSignals: ["Uses else correctly as the no-exception path", "Places finally last in both cases"],
    weakAnswerSignals: ["Runs else and except together", "Omits finally on the exception path"],
    followUpPrompts: ["What does else give you that code after the try block does not?"],
    mayaPushbacks: ["Why not just put the else code at the end of the try block?"]
  }),
  question("py", "python-runtime", "backend", 6, "06-class-attribute.py", {
    title: "Class attribute, instance attribute",
    difficulty: "medium",
    objective: "Explain how attribute lookup falls back to the class and when writing breaks the link.",
    explanation:
      "Reading an attribute falls back to the class when the instance has none. `self.total += 1` reads through to the class but writes to the instance, so that instance now shadows the class attribute and later class-level changes no longer reach it. The instance that never wrote still follows the class.",
    hints: ["Where does the read find the value?", "Where does the augmented assignment write it?"],
    tags: ["python", "classes", "attributes"],
    whatItTests: ["attribute lookup order", "shadowing on write", "shared class state"],
    goodAnswerSignals: ["Separates the read path from the write path", "Explains why the two instances diverge"],
    weakAnswerSignals: ["Expects both instances to track the class attribute"],
    followUpPrompts: ["How would you make a counter genuinely shared across instances?"],
    mayaPushbacks: ["Both objects are the same class — why do they disagree?"]
  }),
  question("py", "python-runtime", "backend", 7, "07-generator-exhaustion.py", {
    title: "The generator that empties",
    difficulty: "easy",
    objective: "Distinguish a one-pass iterator from a materialised sequence.",
    explanation:
      "A generator expression yields its values once. After the first `sum` drains it, the second sees an empty iterator and returns zero. A list comprehension builds a real list, so it can be traversed as often as you like.",
    hints: ["How many times can a generator be iterated?", "What does the comprehension build?"],
    tags: ["python", "generators", "iteration"],
    whatItTests: ["generator exhaustion", "lazy vs eager evaluation"],
    goodAnswerSignals: ["Says the generator is consumed by the first pass"],
    weakAnswerSignals: ["Expects the same total twice from the generator"],
    followUpPrompts: ["When is the lazy version the one you want anyway?"],
    mayaPushbacks: ["Nothing was removed from it — why is the second total zero?"]
  }),
  question("py", "python-runtime", "backend", 8, "08-truthiness.py", {
    title: "or does not return a boolean",
    difficulty: "easy",
    objective: "Explain what the boolean operators actually return and what counts as falsy.",
    explanation:
      "`or` returns the first truthy operand, or the last one if none are; `and` returns the first falsy operand, or the last one if none are. Neither converts to a boolean. Empty containers and zero are falsy, but a list containing zero is not empty and is therefore truthy.",
    hints: ["What type does `or` return?", "Is a list holding a falsy value itself falsy?"],
    tags: ["python", "operators", "truthiness"],
    whatItTests: ["short-circuit return values", "falsy containers"],
    goodAnswerSignals: ["Says the operators return operands, not booleans"],
    weakAnswerSignals: ["Expects True or False from every line"],
    followUpPrompts: ["When does `x or default` give you the wrong default?"],
    mayaPushbacks: ["Why is `[0]` truthy when `0` is not?"]
  }),
  question("py", "python-runtime", "backend", 9, "09-star-unpacking.py", {
    title: "Starred unpacking",
    difficulty: "easy",
    objective: "Predict how a starred target divides a sequence.",
    explanation:
      "The starred name absorbs whatever the fixed names do not claim, and it is always a list — including the empty list when there is nothing left over. Position decides which end it takes from.",
    hints: ["How many elements do the non-starred names take?", "What type is the starred name?"],
    tags: ["python", "unpacking", "sequences"],
    whatItTests: ["starred assignment", "list type of the remainder"],
    goodAnswerSignals: ["Gets the empty list case right"],
    weakAnswerSignals: ["Expects a tuple", "Errors on the two-element case"],
    followUpPrompts: ["What happens with two starred names in one target?"],
    mayaPushbacks: ["Why is the middle an empty list rather than an error?"]
  }),
  question("py", "python-runtime", "backend", 10, "10-sort-stability.py", {
    title: "Stable, even reversed",
    difficulty: "medium",
    objective: "Explain what sort stability guarantees and what `reverse=True` does not undo.",
    explanation:
      "Python's sort is stable: records with equal keys keep their original relative order. `reverse=True` reverses the ordering of the keys, not the stability — equal keys still come out in input order rather than flipped.",
    hints: ["What happens to two records with the same key?", "Does reverse=True reverse the whole output?"],
    tags: ["python", "sorting", "stability"],
    whatItTests: ["sort stability", "reverse semantics"],
    goodAnswerSignals: ["Keeps equal-key pairs in input order under reverse"],
    weakAnswerSignals: ["Reverses the whole list including the ties"],
    followUpPrompts: ["How would you sort by count descending, then name ascending?"],
    mayaPushbacks: ["Reverse means backwards — why did the tied pair not swap?"]
  })
];

export const JAVA = [
  question("java", "java-runtime", "backend", 1, "01-integer-cache.java", {
    title: "Two boxes, one cache",
    difficulty: "medium",
    objective: "Explain when == compares boxed values and when it compares references.",
    explanation:
      "Autoboxing caches Integer objects from -128 to 127, so two boxed 127s are the same object and == is true. 128 falls outside the cache, so two separate objects compare false even though equals is true. Comparing a boxed value with a primitive unboxes it, which is a value comparison again.",
    hints: ["What range does the Integer cache cover?", "What happens when one side is a primitive?"],
    tags: ["java", "autoboxing", "equality"],
    whatItTests: ["Integer cache", "reference vs value comparison", "unboxing in =="],
    goodAnswerSignals: ["Names the cache range", "Explains the primitive comparison separately"],
    weakAnswerSignals: ["Says == always compares values for Integer"],
    followUpPrompts: ["Why is this a bug that only shows up with large inputs?"],
    mayaPushbacks: ["Both lines look identical — why do they disagree?"]
  }),
  question("java", "java-runtime", "backend", 2, "02-string-pool.java", {
    title: "The string pool",
    difficulty: "easy",
    objective: "Explain which strings share an object and which do not.",
    explanation:
      "String literals are interned, so two identical literals are the same object. `new String` deliberately creates a separate object, so == is false while equals is true. Calling intern returns the pooled instance, which is the literal.",
    hints: ["Where do literals live?", "What does `new` guarantee?"],
    tags: ["java", "strings", "equality"],
    whatItTests: ["string interning", "reference vs value equality"],
    goodAnswerSignals: ["Distinguishes the pool from the heap"],
    weakAnswerSignals: ["Uses == for string content throughout"],
    followUpPrompts: ["When would you ever call intern deliberately?"],
    mayaPushbacks: ["The characters are identical — why is == false?"]
  }),
  question("java", "java-runtime", "backend", 3, "03-overload-resolution.java", {
    title: "Which overload runs",
    difficulty: "medium",
    objective: "Explain that overload selection uses the static type, not the runtime type.",
    explanation:
      "Overloads are chosen at compile time from the declared type of the expression. A String literal picks the String overload; the same object held in an Object variable picks the Object one, because that is what the compiler sees. A bare null picks the most specific applicable overload.",
    hints: ["What type does the compiler see for each argument?", "Is this decided at compile time or run time?"],
    tags: ["java", "overloading", "static-dispatch"],
    whatItTests: ["static overload resolution", "most specific overload", "static vs dynamic type"],
    goodAnswerSignals: ["Says overloads are static and overrides are dynamic"],
    weakAnswerSignals: ["Expects the runtime type to select the overload"],
    followUpPrompts: ["How does this differ from an overridden method?"],
    mayaPushbacks: ["The object really is a String — why did the Object version run?"]
  }),
  question("java", "java-runtime", "backend", 4, "04-field-hiding.java", {
    title: "Fields hide, methods override",
    difficulty: "medium",
    objective: "Separate field hiding from method overriding.",
    explanation:
      "Methods are dispatched on the runtime type, so the subclass method runs. Fields are not: they are resolved from the declared type of the reference, so the same object shows the parent's field through a parent reference and the child's through a child reference.",
    hints: ["Which of the two is resolved at run time?", "What decides which field you read?"],
    tags: ["java", "inheritance", "dispatch"],
    whatItTests: ["field hiding", "virtual dispatch", "declared vs runtime type"],
    goodAnswerSignals: ["States the rule for each of fields and methods"],
    weakAnswerSignals: ["Expects the field to follow the object like the method does"],
    followUpPrompts: ["Why is hiding a field almost always a mistake?"],
    mayaPushbacks: ["It is one object — how can it have two values for the same name?"]
  }),
  question("java", "java-runtime", "backend", 5, "05-finally-return.java", {
    title: "finally after return",
    difficulty: "medium",
    objective: "Explain what a finally block can and cannot change about a returned value.",
    explanation:
      "The return value is computed before finally runs. Reassigning a local afterwards changes the variable, not the value already captured for return. Mutating the object a reference points at is different: the caller sees the mutation, because the returned reference and the mutated object are the same thing.",
    hints: ["When is the returned value fixed?", "Is the second case changing the variable or the object?"],
    tags: ["java", "exceptions", "references"],
    whatItTests: ["finally semantics", "value vs reference mutation"],
    goodAnswerSignals: ["Separates rebinding the local from mutating the object"],
    weakAnswerSignals: ["Expects both cases to behave the same way"],
    followUpPrompts: ["What would returning from inside finally do here?"],
    mayaPushbacks: ["Both finally blocks changed something — why does only one show?"]
  }),
  question("java", "java-runtime", "backend", 6, "06-pass-by-value.java", {
    title: "Java passes references by value",
    difficulty: "easy",
    objective: "Explain what a method can and cannot change about its caller's variables.",
    explanation:
      "Arguments are copies. Reassigning the parameter rebinds only the local copy, so the caller's variable is untouched. Mutating the object the copy points at is visible to the caller, because both names refer to the same object. Strings are immutable, so there is nothing to mutate and only rebinding is possible.",
    hints: ["What exactly is copied at the call?", "Why can a String never show the change?"],
    tags: ["java", "parameters", "references"],
    whatItTests: ["pass-by-value of references", "mutation vs reassignment", "immutability"],
    goodAnswerSignals: ["Says the reference is copied, not the object"],
    weakAnswerSignals: ["Calls Java pass-by-reference for objects"],
    followUpPrompts: ["How would you let a method replace the caller's array?"],
    mayaPushbacks: ["The array changed — is that not pass-by-reference?"]
  }),
  question("java", "java-runtime", "backend", 7, "07-integer-overflow.java", {
    title: "Arithmetic that wraps",
    difficulty: "medium",
    objective: "Predict overflow, narrowing, and truncating division.",
    explanation:
      "int arithmetic wraps silently on overflow, so the maximum plus one is the minimum. The minimum has no positive counterpart, so its absolute value is itself. Narrowing to byte keeps the low eight bits. Integer division truncates toward zero, and the remainder takes the sign of the left operand.",
    hints: ["What happens past the maximum?", "Which way does integer division round for negatives?"],
    tags: ["java", "arithmetic", "overflow"],
    whatItTests: ["silent overflow", "narrowing conversion", "truncating division and remainder sign"],
    goodAnswerSignals: ["Explains why abs of the minimum is negative"],
    weakAnswerSignals: ["Expects an exception on overflow", "Rounds negative division down"],
    followUpPrompts: ["Where does this show up in a midpoint calculation?"],
    mayaPushbacks: ["Absolute value should be positive — why is it not?"]
  }),
  question("java", "java-runtime", "backend", 8, "08-char-arithmetic.java", {
    title: "char is a number until it is not",
    difficulty: "easy",
    objective: "Predict when char promotes to int and when concatenation takes over.",
    explanation:
      "Arithmetic on char promotes to int, so adding one prints a number unless you cast back. Two chars added together are two ints added together. In a concatenation the operators run left to right, so starting with a string makes everything after it text, while bracketing the arithmetic keeps it numeric.",
    hints: ["What type does char + int produce?", "Which direction does + associate?"],
    tags: ["java", "types", "operators"],
    whatItTests: ["numeric promotion", "string concatenation order"],
    goodAnswerSignals: ["Explains both concatenation lines by associativity"],
    weakAnswerSignals: ["Expects char + int to stay a char"],
    followUpPrompts: ["How would you print the next letter of the alphabet?"],
    mayaPushbacks: ["Why does one concatenation add and the other join?"]
  }),
  question("java", "java-runtime", "backend", 9, "09-list-remove.java", {
    title: "remove by index or by value",
    difficulty: "medium",
    objective: "Explain which overload of remove an int argument selects.",
    explanation:
      "List has both remove(int index) and remove(Object). A bare int matches the index overload exactly, so it removes a position rather than a value. Boxing the argument selects the Object overload and removes by value.",
    hints: ["Which overload does an int match without conversion?", "How do you force the other one?"],
    tags: ["java", "collections", "overloading"],
    whatItTests: ["overload selection with primitives", "List remove semantics"],
    goodAnswerSignals: ["Names both overloads and why the int wins"],
    weakAnswerSignals: ["Expects removal by value throughout"],
    followUpPrompts: ["Why does this bug survive code review so often?"],
    mayaPushbacks: ["The list contains that number — why was a different one removed?"]
  }),
  question("java", "java-runtime", "backend", 10, "10-initialization-order.java", {
    title: "Initialization order",
    difficulty: "hard",
    objective: "Order static initialization against instance initialization.",
    explanation:
      "Static initializers run once when the class is first loaded, in source order, before main. Then, per instance: field initializers and instance blocks run in source order, and the constructor body runs last.",
    hints: ["What runs before main?", "Where does the constructor body sit relative to field initializers?"],
    tags: ["java", "classes", "initialization"],
    whatItTests: ["static vs instance initialization", "source-order execution"],
    goodAnswerSignals: ["Puts both static blocks before main", "Puts the constructor body last"],
    weakAnswerSignals: ["Runs the constructor before the field initializers"],
    followUpPrompts: ["When does the class actually get loaded here?"],
    mayaPushbacks: ["The constructor is written above one of those blocks — why does it run after?"]
  })
];

export const CPP = [
  question("cpp", "cpp-runtime", "backend", 1, "01-range-for-copy.cpp", {
    title: "The loop variable is a copy",
    difficulty: "easy",
    objective: "Explain when a range-for can modify the container.",
    explanation:
      "Declaring the loop variable by value copies each element, so assigning to it changes the copy and the container is untouched. Declaring it as a reference binds to the element itself, and the assignment lands in the vector.",
    hints: ["What does `int v` bind to?", "What changes when you write `int&`?"],
    tags: ["cpp", "references", "loops"],
    whatItTests: ["value vs reference binding", "range-for semantics"],
    goodAnswerSignals: ["Names the copy explicitly"],
    weakAnswerSignals: ["Expects the first loop to modify the vector"],
    followUpPrompts: ["When is `const auto&` the right default here?"],
    mayaPushbacks: ["The loop clearly assigns — why did nothing change?"]
  }),
  question("cpp", "cpp-runtime", "backend", 2, "02-map-subscript.cpp", {
    title: "Subscript inserts",
    difficulty: "medium",
    objective: "Explain the side effect of map's subscript operator.",
    explanation:
      "operator[] on a map default-constructs and inserts the key when it is missing, so merely reading a missing key grows the map. `count` does not insert, which is why the size only changes after the subscript.",
    hints: ["What does the map do when the key is absent?", "Does count have the same effect?"],
    tags: ["cpp", "containers", "side-effects"],
    whatItTests: ["operator[] insertion", "read-only lookup alternatives"],
    goodAnswerSignals: ["Notices the size change caused by a read"],
    weakAnswerSignals: ["Expects the size to stay zero throughout"],
    followUpPrompts: ["Which lookup would you use on a const map?"],
    mayaPushbacks: ["Nothing was assigned — why did the map grow?"]
  }),
  question("cpp", "cpp-runtime", "backend", 3, "03-slicing-and-virtual.cpp", {
    title: "Slicing, and what virtual buys",
    difficulty: "hard",
    objective: "Separate virtual dispatch from object slicing.",
    explanation:
      "Through a pointer, a virtual call reaches the derived override while a non-virtual call is resolved from the static type. Passing by value slices the object down to the base part, so even the virtual call runs the base version. Passing by reference keeps the object whole and dispatch works.",
    hints: ["Which call is decided at run time?", "What survives a copy into a base-typed parameter?"],
    tags: ["cpp", "polymorphism", "slicing"],
    whatItTests: ["virtual dispatch", "object slicing", "static vs dynamic type"],
    goodAnswerSignals: ["Names slicing as the reason the by-value call differs"],
    weakAnswerSignals: ["Expects virtual to work through a by-value parameter"],
    followUpPrompts: ["What should the parameter type have been?"],
    mayaPushbacks: ["The method is virtual — why did the base version run?"]
  }),
  question("cpp", "cpp-runtime", "backend", 4, "04-static-local-and-destruction.cpp", {
    title: "Static locals and destruction order",
    difficulty: "medium",
    objective: "Predict how long a static local lives and the order objects are destroyed.",
    explanation:
      "A static local is initialised once, on first use, and keeps its value across calls. Automatic objects are destroyed at the end of their scope in reverse order of construction, which is why the second one is destroyed first.",
    hints: ["How often does the static initializer run?", "In what order does a scope unwind?"],
    tags: ["cpp", "lifetime", "raii"],
    whatItTests: ["static local lifetime", "reverse destruction order"],
    goodAnswerSignals: ["Says destruction is reverse of construction"],
    weakAnswerSignals: ["Resets the counter on each call", "Destroys in declaration order"],
    followUpPrompts: ["Why does RAII depend on that ordering?"],
    mayaPushbacks: ["Why is the counter not back at one?"]
  }),
  question("cpp", "cpp-runtime", "backend", 5, "05-integer-conversions.cpp", {
    title: "When signed meets unsigned",
    difficulty: "hard",
    objective: "Predict integer division, remainder sign, and signed-to-unsigned conversion.",
    explanation:
      "Integer division truncates toward zero and the remainder takes the sign of the left operand. Mixing an int with an unsigned int converts the int to unsigned, so a negative value becomes a very large positive one and the comparison flips. Dividing by a double promotes instead, giving a real result.",
    hints: ["Which operand gets converted in a mixed comparison?", "Which way does truncation round?"],
    tags: ["cpp", "arithmetic", "conversions"],
    whatItTests: ["usual arithmetic conversions", "truncating division", "signed comparison pitfalls"],
    goodAnswerSignals: ["Explains the conversion direction in the comparison"],
    weakAnswerSignals: ["Expects -1 to compare less than 1 here"],
    followUpPrompts: ["Why does comparing against `.size()` cause this so often?"],
    mayaPushbacks: ["-1 is obviously less than 1 — why did it print otherwise?"]
  }),
  question("cpp", "cpp-runtime", "backend", 6, "06-value-vs-reference.cpp", {
    title: "Copies at the call boundary",
    difficulty: "easy",
    objective: "Explain which parameter forms let a function change the caller's container.",
    explanation:
      "A by-value parameter copies the whole vector, so anything the function appends is lost with the copy. A reference parameter binds to the caller's object. Copy-assigning a vector copies its elements too, so the copy grows independently.",
    hints: ["What does the by-value parameter cost?", "Does assigning a vector share or copy?"],
    tags: ["cpp", "parameters", "value-semantics"],
    whatItTests: ["value semantics of containers", "reference parameters"],
    goodAnswerSignals: ["Notes both the correctness and the cost of the copy"],
    weakAnswerSignals: ["Expects the by-value call to modify the caller"],
    followUpPrompts: ["When is `const&` the right choice and when is by-value fine?"],
    mayaPushbacks: ["The function pushed onto it — why is the size unchanged?"]
  }),
  question("cpp", "cpp-runtime", "backend", 7, "07-string-value-semantics.cpp", {
    title: "Strings copy, and compare byte by byte",
    difficulty: "easy",
    objective: "Predict copy behaviour and lexicographic comparison for std::string.",
    explanation:
      "Assigning a string copies it, so writing through one does not affect the other. Comparison is lexicographic over characters, not numeric: \"10\" sorts before \"9\" because '1' precedes '9'.",
    hints: ["Does assignment share the buffer?", "How are two strings ordered?"],
    tags: ["cpp", "strings", "comparison"],
    whatItTests: ["value semantics", "lexicographic ordering"],
    goodAnswerSignals: ["Explains the numeric-looking comparison correctly"],
    weakAnswerSignals: ["Compares the strings as numbers"],
    followUpPrompts: ["How would you sort version strings correctly?"],
    mayaPushbacks: ["Ten is bigger than nine — why did it compare smaller?"]
  }),
  question("cpp", "cpp-runtime", "backend", 8, "08-erase-remove.cpp", {
    title: "remove does not remove",
    difficulty: "medium",
    objective: "Explain the erase-remove idiom and what lower_bound returns.",
    explanation:
      "`std::remove` shuffles the surviving elements to the front and returns the new logical end; it cannot change the container's size, which is why `erase` has to follow. `lower_bound` returns the first position not less than the value, which is an insertion point rather than a found flag.",
    hints: ["Can an algorithm resize the container it was given?", "What does lower_bound point at?"],
    tags: ["cpp", "algorithms", "iterators"],
    whatItTests: ["erase-remove idiom", "iterator-returning algorithms"],
    goodAnswerSignals: ["Says remove only reorders and returns an iterator"],
    weakAnswerSignals: ["Expects remove alone to shrink the vector"],
    followUpPrompts: ["What does the tail of the vector hold between the two calls?"],
    mayaPushbacks: ["Why does an algorithm called remove not remove anything?"]
  }),
  question("cpp", "cpp-runtime", "backend", 9, "09-copy-constructor.cpp", {
    title: "Counting the copies",
    difficulty: "medium",
    objective: "Identify where copies actually happen.",
    explanation:
      "Passing by value copies, so the parameter is a new object with a new id. Initialising one object from another lvalue also copies — that is not elided, because there is no temporary to elide. Each copy runs the copy constructor and bumps the shared counter.",
    hints: ["How many objects exist by the end?", "Which initialisations invoke the copy constructor?"],
    tags: ["cpp", "copies", "constructors"],
    whatItTests: ["copy construction", "pass-by-value cost"],
    goodAnswerSignals: ["Accounts for every copy and the final counter"],
    weakAnswerSignals: ["Assumes the compiler elides the lvalue copy"],
    followUpPrompts: ["Which of these copies would a reference parameter remove?"],
    mayaPushbacks: ["Only one object was declared before the call — why is the id two?"]
  }),
  question("cpp", "cpp-runtime", "backend", 10, "10-shadowing.cpp", {
    title: "Shadowing and the global scope",
    difficulty: "easy",
    objective: "Resolve a name against nested scopes.",
    explanation:
      "An inner declaration hides the outer one for the rest of its scope, and the hidden name comes back when the inner scope ends. The scope resolution operator reaches past every local declaration to the global one.",
    hints: [
      "Which declaration is in scope on each line?",
      "What scope does the :: prefix reach past the local ones to find?"
    ],
    tags: ["cpp", "scope", "names"],
    whatItTests: ["name shadowing", "scope resolution"],
    goodAnswerSignals: ["Tracks the value back after the inner block ends"],
    weakAnswerSignals: ["Carries the innermost value past its block"],
    followUpPrompts: ["Why do compilers offer a warning for this?"],
    mayaPushbacks: ["The variable was reassigned inside the block — why did it revert?"]
  })
];
