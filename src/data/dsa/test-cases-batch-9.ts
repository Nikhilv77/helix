import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";

export const structuredDsaTestCasesBatch9: Record<string, StructuredDsaTestCase[]> = {
  "target-sum": [
    { arguments: [[1,1,1,1,1],3], expectedValue: 5 },
    { arguments: [[1],1], expectedValue: 1 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[1],1], expectedValue: 1 },
    { arguments: [[1],-1], expectedValue: 1 },
    { arguments: [[1],2], expectedValue: 0 },
    { arguments: [[0],0], expectedValue: 2 },
    { arguments: [[0,0,1],1], expectedValue: 4 },
    { arguments: [[1,1,1,1,1],5], expectedValue: 1 },
    { arguments: [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],0], expectedValue: 184756 },
    { arguments: [[4,0,5,2,0,3,4,5,3,3,4,2,3,5,3,0,5,1,4,3],3], expectedValue: 53336 }
  ],
  "word-break": [
    { arguments: ["leetcode",["leet","code"]], expectedValue: true },
    { arguments: ["applepenapple",["apple","pen"]], expectedValue: true },
    { arguments: ["catsandog",["cats","dog","sand","and","cat"]], expectedValue: false },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["",["a"]], expectedValue: true },
    { arguments: ["a",["a"]], expectedValue: true },
    { arguments: ["a",["b"]], expectedValue: false },
    { arguments: ["aa",["a"]], expectedValue: true },
    { arguments: ["aaaaab",["a","aa","aaa","aaaa"]], expectedValue: false },
    { arguments: ["cars",["car","ca","rs"]], expectedValue: true },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",["a","aa","aaa"]], expectedValue: true },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",["a","aa","aaa","aaaa"]], expectedValue: false }
  ],
  "longest-increasing-subsequence": [
    { arguments: [[10,9,2,5,3,7,101,18]], expectedValue: 4 },
    { arguments: [[0,1,0,3,2,3]], expectedValue: 4 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: 0 },
    { arguments: [[1]], expectedValue: 1 },
    { arguments: [[2,1]], expectedValue: 1 },
    { arguments: [[7,7,7,7]], expectedValue: 1 },
    { arguments: [[1,2,3,4,5]], expectedValue: 5 },
    { arguments: [[5,4,3,2,1]], expectedValue: 1 },
    { arguments: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499]], expectedValue: 500 },
    { arguments: [[69,-77,5,-73,78,-48,17,20,-22,-84,74,23,-58,65,-93,60,-99,67,-55,6,-15,94,-81,-4,20,-95,44,98,-30,69,-21,-49,-59,73,13,38,-98,-32,-46,34,-9,97,-34,-48,55,-9,-38,-73,-35,-79,27,-47,-29,49,-19,-95,-94,-48,89,19,67,87,56,38,68,-69,-75,56,-92,68,44,79,6,-72,27,63,41,83,-97,59,7,100,-61,45,-35,48,17,18,-38,-26,-82,-89,81,42,-33,15,63,28,-97,-5,5,39,28,65,82,-56,10,72,17,-73,29,-80,0,-50,7,67,-71,99,-69,62,-53,79,-18,92,62,-9,-44,-52,-52,52,-97,86,91,27,90,-42,-34,-14,11,-74,89,-84,-100,23,-52,72,94,46,-26,-8,83,-21,-34,0,0,-34,57,-83,45,98,-53,1,51,9,-3,2,-66,36,-59,79,58,-22,-60,-62,92,-11,82,40,-70,-44,-51,49,-51,-86,-14,-79,-80,-18,-13,46,-17,-60,-71,97,28,80,-78,-61,27,51,77,-62,60,69,27,-68,-22,-50,60,-27,95,81,-95,47,7,-49,20,30,-54,-71,11,6,-46,37,-54,26,59,-78,-88,18,-64,31,-97,-85,49,-40,95,80,-96,95,-5,-59,-38,-33,38,48,52,-3,-92,-24,-98,-46,22,-79,36,7,-95,-25,48,33,-85,-59,-42,75,77,58,-94,60,-8,-84,-84,98,-13,37,-42,61,18,-9,-11,43,43,-29,97,-74,84,66,-12,67,-14,-90,66,36,-98,-50,100,89,-68,-97,81,99,-79,-23,-5,-61,26,65,-96,17,-21,-95,60,32,4,-96,13,27,11,-6,54,78,-72,-55,-59,-85,-63,-33,19,-2,-78,-86,13,-92,68,16,59,-43,-55,-71,-6,-1,-57,40,-35,-88,91,81,-74,-46,76,-19,76,-38,-76,36,68,94,-67,76,-85,-24,86,92,-20,31,73,-87,8,-76,-76,36,-87,-74,-96,-20,-22,-84,84,-90,100,-79,-39,43,-26,-13,-21,-81,-20,41,-80,-44,29,-81,-74,48,24,-8,-25,-3,-6,-44,-38,-59,-20,91,42,79,-21,35,13,-23,47,-56,69,60,26,66,14,57,74,65,62,-6,-69,-51,24,-55,-57,60,-58,-26,38,-92,-26,-35,7,-68,-81,61,100,88,71,17,73,-82,-32,-86,12,-2,-50,46,7,-40,-56,89,-51,-61,61,81,58,-42,4,-72,-68,-48,-77,81,70,0,81,55,-36,76,-85,-12,-22,-96,-29,-100,49,37,68,53,-69,59,-28,77,-93,20,-87,95,0,6,72,58,84,99,-78,71,35,-65]], expectedValue: 40 },
    { arguments: [[0]], expectedValue: 872, build: [{"ints":{"n":200000,"lo":-100000,"hi":100000,"seed":43}}] }
  ],
  "longest-common-subsequence": [
    { arguments: ["abcde","ace"], expectedValue: 3 },
    { arguments: ["abc","abc"], expectedValue: 3 },
    { arguments: ["abc","def"], expectedValue: 0 },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["",""], expectedValue: 0 },
    { arguments: ["a",""], expectedValue: 0 },
    { arguments: ["a","a"], expectedValue: 1 },
    { arguments: ["a","b"], expectedValue: 0 },
    { arguments: ["ab","ba"], expectedValue: 1 },
    { arguments: ["abcdef","fedcba"], expectedValue: 1 },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], expectedValue: 200 },
    { arguments: ["abcbdab","bdcaba"], expectedValue: 4 }
  ],
  "longest-palindromic-subsequence": [
    { arguments: ["bbbab"], expectedValue: 4 },
    { arguments: ["cbbd"], expectedValue: 2 },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["a"], expectedValue: 1 },
    { arguments: ["ab"], expectedValue: 1 },
    { arguments: ["aa"], expectedValue: 2 },
    { arguments: ["aba"], expectedValue: 3 },
    { arguments: ["abcdef"], expectedValue: 1 },
    { arguments: ["agbdba"], expectedValue: 5 },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], expectedValue: 200 },
    { arguments: ["character"], expectedValue: 5 }
  ],
  "edit-distance": [
    { arguments: ["horse","ros"], expectedValue: 3 },
    { arguments: ["intention","execution"], expectedValue: 5 },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["",""], expectedValue: 0 },
    { arguments: ["a",""], expectedValue: 1 },
    { arguments: ["","abc"], expectedValue: 3 },
    { arguments: ["a","a"], expectedValue: 0 },
    { arguments: ["ab","ba"], expectedValue: 2 },
    { arguments: ["abc","xyz"], expectedValue: 3 },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], expectedValue: 100 },
    { arguments: ["kitten","sitting"], expectedValue: 3 }
  ],
  "interleaving-string": [
    { arguments: ["aabcc","dbbca","aadbbcbcac"], expectedValue: true },
    { arguments: ["aabcc","dbbca","aadbbbaccc"], expectedValue: false },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["","",""], expectedValue: true },
    { arguments: ["a","","a"], expectedValue: true },
    { arguments: ["","a","a"], expectedValue: true },
    { arguments: ["a","b","ab"], expectedValue: true },
    { arguments: ["a","b","ba"], expectedValue: true },
    { arguments: ["a","b","abc"], expectedValue: false },
    { arguments: ["aa","aa","aaaa"], expectedValue: true },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], expectedValue: true }
  ],
  "palindromic-substrings": [
    { arguments: ["abc"], expectedValue: 3 },
    { arguments: ["aaa"], expectedValue: 6 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [""], expectedValue: 0 },
    { arguments: ["a"], expectedValue: 1 },
    { arguments: ["ab"], expectedValue: 2 },
    { arguments: ["aa"], expectedValue: 3 },
    { arguments: ["aba"], expectedValue: 4 },
    { arguments: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], expectedValue: 5050 },
    { arguments: ["abcdefg"], expectedValue: 7 },
    { arguments: ["racecarannakayak"], expectedValue: 25 }
  ],
  "best-time-to-buy-and-sell-stock-ii": [
    { arguments: [[7,1,5,3,6,4]], expectedValue: 7 },
    { arguments: [[1,2,3,4,5]], expectedValue: 4 },
    { arguments: [[7,6,4,3,1]], expectedValue: 0 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: 0 },
    { arguments: [[1]], expectedValue: 0 },
    { arguments: [[1,2]], expectedValue: 1 },
    { arguments: [[2,1]], expectedValue: 0 },
    { arguments: [[3,3,3]], expectedValue: 0 },
    { arguments: [[1,5,1,5,1,5]], expectedValue: 12 },
    { arguments: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499]], expectedValue: 499 },
    { arguments: [[980,322,751,582,748,699,909,797,645,797,229,289,53,844,387,927,276,978,23,984,274,743,473,426,494,402,536,934,692,183,376,932,877,849,271,732,2,732,471,16,303,775,529,330,580,489,908,239,913,475,749,221,563,250,725,63,117,568,134,659,169,10,899,866,597,998,325,616,880,714,328,507,798,324,365,173,981,111,242,753,128,141,721,304,451,981,274,556,373,340,483,84,666,980,660,183,567,836,232,696,589,530,638,235,900,529,643,360,800,760,130,774,759,818,178,92,459,452,387,373,59,406,992,540,685,766,179,905,841,975,409,126,67,416,224,449,990,543,51,182,636,876,680,707,354,618,669,144,393,681,773,148,39,132,885,764,31,441,234,780,20,766,645,397,744,544,592,234,937,29,23,708,855,938,110,32,879,874,343,386,839,807,508,128,557,847,74,831,265,990,811,459,377,375,151,684,964,723,974,982,592,715,230,158,480,471,443,931,997,690,373,605,17,136,358,704,205,726,986,62,979,1000,479,612,910,260,646,537,882,23,172,467,722,946,836,555,698,47,978,217,140,597,615,12,573,904,411,19,122,14,9,284,730,259,839,0,73,717,980,146,301,759,801,733,37,960,250,310,225,211,844,162,819,491,301,30,707,698,329,384,161,560,82,149,119,925,776,192,68,853,126,374,491,357,412,334,428,393,493,494,319,821,301,842,897,459,235,5,581,931,250,994,784,407,250,34,136,927,924,564,599,407,516,470,323,374,679,412,869,824,610,500,548,640,930,827,976,62,430,105,238,257,796,352,103,856,969,673,468,218,75,524,24,276,858,403,114,13,978,218,378,228,838,942,308,465,687,187,583,17,557,46,326,885,787,509,942,793,944,489,108,27,118,700,350,359,203,91,237,173,439,278,984,494,423,925,343,946,522,583,628,152,51,415,60,593,1,974,422,208,747,678,792,769,172,881,46,885,42,719,177,262,154,928,262,145,902,790,432,43,124,277,533,716,191,329,241,837,619,300,892,802,420,308,322,749,680,613,280,852,548,212,159,397,54,903,46,761,23,436,810,15,819,481,258,445,23,747,834,504,65,29,397,647,119,811,25,611,990,144,993,724,407,743,401,890,691,794,153,554,9,299,418,282,122,602,23,725,399,648,581,145,708,129,254,478,557,47,250,358,181,28,445,650,947,466,398,987,696,912,633,666,404,874,918,135,138,901,978,303,349,108,210,607,386,509,340,951,831,775,336,238,451,45,299,25,938,604,0,113,554,686,911,975,341,557,624,710,146,332,273,365,992,588,979,796,963,279,703,949,507,720,317,122,138,176,539,759,257,353,991,200,710,422,220,769,742,207,890,88,469,727,893,855,381,184,79,364,417,977,320,661,445,108,213,172,450,184,441,871,610,236,295,886,502,256,635,773,322,639,871,166,923,945,109,449,758,226,883,518,156,363,645,227,707,884,537,658,896,876,210,12,551,819,124,288,350,747,806,859,314,369,360,144,437,412,401,312,466,83,400,16,643,176,484,477,969,459,178,439,422,724,453,520,476,283,664,227,601,783,481,114,696,921,804,451,930,221,42,929,19,570,509,808,743,386,249,891,579,808,388,727,12,502,120,189,458,791,23,67,558,869,435,770,528,310,658,22,748,971,603,311,947,994,898,41,406,199,966,253,855,991,16,248,727,987,118,907,235,476,467,716,49,673,144,925,175,856,625,468,244,122,4,985,544,431,517,288,264,763,778,788,31,597,246,24,756,774,127,33,240,716,494,707,902,465,914,885,183,620,268,278,554,871,404,171,537,931,313,74,588,599,744,256,481,999,283,839,59,206,537,299,969,807,422,897,293,338,798,900,970,161,374,887,184,199,772,188,666,19,828,961,165,325,85,570,488,382,209,42,306,687,715,596,180,190,821,111,233,674,420,367,168,333,608,683,265,953,969,781,944,579,138,333,569,849,800,86,745,517,973,13,267,161,589,605,928,57,844,642,813,570,998,304,363,894,323,748,15,684,913,83,874,706,361,173,534,466,356,540,720,802,602,942,210,779,297,704,502,107,801,991,485,514,677,856,75,729,783,670,67,484,559,206,695,808,568,26,815,13,684,951,62,652,384,74,670,116,391,944,16,321,221,585,830,894,361,492,829,535,989,638,69,289,959,915,45,187,794,528,19,886,621,218,330,837,267,306,401,266,71,526,979,657,590,836,295,632,193,42,902,639,667,429,22,391,218,473,348,51,405,242,795,747,601,362,606,537,130,204,950,661,915,713,250,163,484,321,580,925]], expectedValue: 174931 }
  ],
  "best-time-to-buy-and-sell-stock-with-cooldown": [
    { arguments: [[1,2,3,0,2]], expectedValue: 3 },
    { arguments: [[1]], expectedValue: 0 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: 0 },
    { arguments: [[1]], expectedValue: 0 },
    { arguments: [[1,2]], expectedValue: 1 },
    { arguments: [[2,1]], expectedValue: 0 },
    { arguments: [[1,2,3,0,2]], expectedValue: 3 },
    { arguments: [[1,5,1,5,1,5]], expectedValue: 8 },
    { arguments: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299]], expectedValue: 299 },
    { arguments: [[12,89,139,19,20,13,55,120,61,149,105,191,84,56,44,142,10,78,112,155,84,85,51,21,119,157,128,151,29,182,2,90,81,198,108,151,15,46,27,50,0,110,71,101,31,107,22,197,169,163,179,31,83,101,200,87,122,172,21,2,125,42,123,195,158,55,184,64,145,142,92,89,108,127,66,77,187,15,52,37,20,106,63,38,146,80,145,3,19,191,81,39,99,178,4,77,26,159,91,107,15,170,20,6,170,75,30,40,68,77,175,108,79,188,20,84,20,197,175,79,137,157,84,153,190,135,8,52,22,181,4,159,170,160,34,31,17,80,25,149,148,144,156,44,149,82,89,199,81,4,58,174,5,192,38,76,173,128,127,14,41,81,61,110,123,70,53,141,118,184,114,172,30,199,180,21,95,161,119,32,119,195,3,1,109,169,112,1,173,34,8,113,67,56,73,64,13,105,165,176,65,96,13,21,73,156,86,171,70,133,54,155,189,109,104,81,102,182,46,187,178,88,159,114,164,151,93,116,75,33,130,73,68,196,111,105,155,194,137,157,29,113,69,54,0,68,69,186,150,87,28,4,47,170,62,129,18,67,136,115,12,177,185,185,155,55,135,53,147,12,53,98,88,127,26,119,52,8,167,148,109,134,86,188,44,64,145,113,63,97,13,148,108,76,147,144,108,155,4,44]], expectedValue: 8169 }
  ],
  "best-time-to-buy-and-sell-stock-iii": [
    { arguments: [[3,3,5,0,0,3,1,4]], expectedValue: 6 },
    { arguments: [[1,2,3,4,5]], expectedValue: 4 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: 0 },
    { arguments: [[1]], expectedValue: 0 },
    { arguments: [[2,1]], expectedValue: 0 },
    { arguments: [[1,2]], expectedValue: 1 },
    { arguments: [[1,5,1,6,1,7]], expectedValue: 11 },
    { arguments: [[7,6,4,3,1]], expectedValue: 0 },
    { arguments: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299]], expectedValue: 299 },
    { arguments: [[29,114,60,180,158,47,124,157,151,109,33,26,133,74,56,78,16,157,37,41,98,9,187,96,148,53,171,41,61,183,185,110,28,30,133,159,115,189,131,117,100,143,0,16,0,25,198,103,19,119,3,149,40,14,139,200,140,63,42,109,155,59,195,156,106,62,56,147,134,54,119,125,15,41,160,7,86,102,162,159,11,97,94,37,172,162,125,198,187,198,139,191,151,154,67,130,96,114,150,185,10,158,95,48,173,77,99,112,15,49,109,111,62,12,142,121,139,181,100,59,167,18,139,191,62,161,124,39,150,137,82,101,195,20,59,116,153,84,179,115,99,194,2,156,59,5,52,7,110,129,130,18,108,29,104,114,87,10,17,162,106,80,186,104,6,2,104,157,189,140,185,76,157,43,91,177,63,155,6,135,165,63,183,130,110,125,186,83,140,46,142,48,106,174,1,27,17,27,156,94,82,83,85,87,80,37,13,31,165,82,103,12,56,82,131,182,177,119,81,69,1,7,71,172,193,191,142,112,62,75,93,75,196,115,57,97,149,104,1,165,194,151,36,170,163,71,133,12,140,118,25,165,56,4,144,79,30,49,3,164,166,157,63,168,39,32,94,80,37,34,102,103,139,4,193,101,160,139,89,137,66,133,193,70,51,38,138,142,114,193,72,74,29,113,185,158,115,33,35,145]], expectedValue: 395 }
  ],
  "burst-balloons": [
    { arguments: [[3,1,5,8]], expectedValue: 167 },
    { arguments: [[1,5]], expectedValue: 10 },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: 0 },
    { arguments: [[5]], expectedValue: 5 },
    { arguments: [[1,1]], expectedValue: 2 },
    { arguments: [[3,1,5]], expectedValue: 35 },
    { arguments: [[9,76,64,21]], expectedValue: 116718 },
    { arguments: [[5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5]], expectedValue: 3530 },
    { arguments: [[5,14,12,13,12,10,11,15,8,19,15,17,13,15,18,10,20,6,15,13,8,14,12,4,13,3,3,5,13,2]], expectedValue: 81616 }
  ],
  "regular-expression-matching": [
    { arguments: ["aa","a"], expectedValue: false },
    { arguments: ["aa","a*"], expectedValue: true },
    { arguments: ["ab",".*"], expectedValue: true },
    // Hidden from here on — generated from the verified reference.
    { arguments: ["",""], expectedValue: true },
    { arguments: ["","a*"], expectedValue: true },
    { arguments: ["a",""], expectedValue: false },
    { arguments: ["a","."], expectedValue: true },
    { arguments: ["aaa","a*a"], expectedValue: true },
    { arguments: ["ab","a*ab"], expectedValue: true },
    { arguments: ["mississippi","mis*is*p*."], expectedValue: false },
    { arguments: ["mississippi","mis*is*ip*."], expectedValue: true },
    { arguments: ["aaaaaaaaaab","a*a*a*a*a*b"], expectedValue: true }
  ],
  "implement-trie-prefix-tree": [
    { arguments: [["insert","apple"],["search","apple"],["search","app"],["startsWith","app"],["insert","app"],["search","app"]], expectedValue: [null,true,false,true,null,true] },
    { arguments: [["insert","cat"],["startsWith","car"]], expectedValue: [null,false] },
    // Hidden from here on — generated from the verified reference.
    { arguments: [["search","a"]], expectedValue: [false] },
    { arguments: [["startsWith","a"]], expectedValue: [false] },
    { arguments: [["insert","a"],["search","a"],["startsWith","a"]], expectedValue: [null,true,true] },
    { arguments: [["insert","app"],["insert","apple"],["search","app"],["search","apple"],["search","appl"]], expectedValue: [null,null,true,true,false] },
    { arguments: [["insert","apple"],["insert","app"],["search","app"],["startsWith","appl"]], expectedValue: [null,null,true,true] },
    { arguments: [["insert","a"],["insert","a"],["search","a"]], expectedValue: [null,null,true] },
    { arguments: [["insert","abc"],["search","abcd"],["startsWith","abcd"]], expectedValue: [null,false,false] },
    { arguments: [["insert","word0"],["insert","word1"],["insert","word2"],["insert","word3"],["insert","word4"],["insert","word5"],["insert","word6"],["insert","word7"],["insert","word8"],["insert","word9"],["insert","word10"],["insert","word11"],["insert","word12"],["insert","word13"],["insert","word14"],["insert","word15"],["insert","word16"],["insert","word17"],["insert","word18"],["insert","word19"],["insert","word20"],["insert","word21"],["insert","word22"],["insert","word23"],["insert","word24"],["insert","word25"],["insert","word26"],["insert","word27"],["insert","word28"],["insert","word29"],["insert","word30"],["insert","word31"],["insert","word32"],["insert","word33"],["insert","word34"],["insert","word35"],["insert","word36"],["insert","word37"],["insert","word38"],["insert","word39"],["insert","word40"],["insert","word41"],["insert","word42"],["insert","word43"],["insert","word44"],["insert","word45"],["insert","word46"],["insert","word47"],["insert","word48"],["insert","word49"],["search","word25"],["search","word50"],["startsWith","word"]], expectedValue: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,true,false,true] }
  ],
  "design-add-and-search-words-data-structure": [
    { arguments: [["addWord","bad"],["addWord","dad"],["addWord","mad"],["search","pad"],["search","bad"],["search",".ad"],["search","b.."]], expectedValue: [null,null,null,false,true,true,true] },
    { arguments: [["addWord","a"],["search","."],["search","b"]], expectedValue: [null,true,false] },
    // Hidden from here on — generated from the verified reference.
    { arguments: [["search","a"]], expectedValue: [false] },
    { arguments: [["search","."]], expectedValue: [false] },
    { arguments: [["addWord","a"],["search","a"],["search","."],["search",".."]], expectedValue: [null,true,true,false] },
    { arguments: [["addWord","bad"],["addWord","dad"],["search","..."],["search","...."]], expectedValue: [null,null,true,false] },
    { arguments: [["addWord","bad"],["addWord","bat"],["search","ba."],["search","b.d"],["search","b.z"]], expectedValue: [null,null,true,true,false] },
    { arguments: [["addWord","a"],["addWord","ab"],["search","a"],["search","a."],["search",".b"]], expectedValue: [null,null,true,true,true] },
    { arguments: [["addWord","wa0"],["addWord","wb1"],["addWord","wc2"],["addWord","wd3"],["addWord","we4"],["addWord","wf5"],["addWord","wg6"],["addWord","wh7"],["addWord","wi8"],["addWord","wj9"],["addWord","wk10"],["addWord","wl11"],["addWord","wm12"],["addWord","wn13"],["addWord","wo14"],["addWord","wp15"],["addWord","wq16"],["addWord","wr17"],["addWord","ws18"],["addWord","wt19"],["addWord","wu20"],["addWord","wv21"],["addWord","ww22"],["addWord","wx23"],["addWord","wy24"],["addWord","wz25"],["addWord","wa26"],["addWord","wb27"],["addWord","wc28"],["addWord","wd29"],["search","w.0"],["search","..."],["search","zzz"]], expectedValue: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,true,true,false] }
  ],
  "subsets": [
    { arguments: [[1,2,3]], expectedValue: [[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]], comparison: "unordered-nested" },
    { arguments: [[0]], expectedValue: [[],[0]], comparison: "unordered-nested" },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: [[]], comparison: "unordered-nested" },
    { arguments: [[1]], expectedValue: [[],[1]], comparison: "unordered-nested" },
    { arguments: [[1,2]], expectedValue: [[],[2],[1],[1,2]], comparison: "unordered-nested" },
    { arguments: [[0,1,2]], expectedValue: [[],[2],[1],[1,2],[0],[0,2],[0,1],[0,1,2]], comparison: "unordered-nested" },
    { arguments: [[-1,1]], expectedValue: [[],[1],[-1],[-1,1]], comparison: "unordered-nested" },
    { arguments: [[1,2,3,4]], expectedValue: [[],[4],[3],[3,4],[2],[2,4],[2,3],[2,3,4],[1],[1,4],[1,3],[1,3,4],[1,2],[1,2,4],[1,2,3],[1,2,3,4]], comparison: "unordered-nested" },
    { arguments: [[1,2,3,4,5,6]], expectedValue: [[],[6],[5],[5,6],[4],[4,6],[4,5],[4,5,6],[3],[3,6],[3,5],[3,5,6],[3,4],[3,4,6],[3,4,5],[3,4,5,6],[2],[2,6],[2,5],[2,5,6],[2,4],[2,4,6],[2,4,5],[2,4,5,6],[2,3],[2,3,6],[2,3,5],[2,3,5,6],[2,3,4],[2,3,4,6],[2,3,4,5],[2,3,4,5,6],[1],[1,6],[1,5],[1,5,6],[1,4],[1,4,6],[1,4,5],[1,4,5,6],[1,3],[1,3,6],[1,3,5],[1,3,5,6],[1,3,4],[1,3,4,6],[1,3,4,5],[1,3,4,5,6],[1,2],[1,2,6],[1,2,5],[1,2,5,6],[1,2,4],[1,2,4,6],[1,2,4,5],[1,2,4,5,6],[1,2,3],[1,2,3,6],[1,2,3,5],[1,2,3,5,6],[1,2,3,4],[1,2,3,4,6],[1,2,3,4,5],[1,2,3,4,5,6]], comparison: "unordered-nested" }
  ],
  "combination-sum": [
    { arguments: [[2,3,6,7],7], expectedValue: [[2,2,3],[7]], comparison: "unordered-nested" },
    { arguments: [[2,3,5],8], expectedValue: [[2,2,2,2],[2,3,3],[3,5]], comparison: "unordered-nested" },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[2],1], expectedValue: [], comparison: "unordered-nested" },
    { arguments: [[2],2], expectedValue: [[2]], comparison: "unordered-nested" },
    { arguments: [[1],3], expectedValue: [[1,1,1]], comparison: "unordered-nested" },
    { arguments: [[2,4],6], expectedValue: [[2,2,2],[2,4]], comparison: "unordered-nested" },
    { arguments: [[5,7],3], expectedValue: [], comparison: "unordered-nested" },
    { arguments: [[3,5,8],11], expectedValue: [[3,3,5],[3,8]], comparison: "unordered-nested" },
    { arguments: [[2,3,5],12], expectedValue: [[2,2,2,2,2,2],[2,2,2,3,3],[2,2,3,5],[2,5,5],[3,3,3,3]], comparison: "unordered-nested" }
  ],
  "permutations": [
    { arguments: [[1,2,3]], expectedValue: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]], comparison: "unordered-nested" },
    { arguments: [[0,1]], expectedValue: [[0,1],[1,0]], comparison: "unordered-nested" },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[]], expectedValue: [[]], comparison: "unordered-nested" },
    { arguments: [[1]], expectedValue: [[1]], comparison: "unordered-nested" },
    { arguments: [[1,2]], expectedValue: [[1,2],[2,1]], comparison: "unordered-nested" },
    { arguments: [[9,8,7]], expectedValue: [[9,8,7],[9,7,8],[8,9,7],[8,7,9],[7,9,8],[7,8,9]], comparison: "unordered-nested" },
    { arguments: [[1,2,3,4]], expectedValue: [[1,2,3,4],[1,2,4,3],[1,3,2,4],[1,3,4,2],[1,4,2,3],[1,4,3,2],[2,1,3,4],[2,1,4,3],[2,3,1,4],[2,3,4,1],[2,4,1,3],[2,4,3,1],[3,1,2,4],[3,1,4,2],[3,2,1,4],[3,2,4,1],[3,4,1,2],[3,4,2,1],[4,1,2,3],[4,1,3,2],[4,2,1,3],[4,2,3,1],[4,3,1,2],[4,3,2,1]], comparison: "unordered-nested" },
    { arguments: [[-1,0,1]], expectedValue: [[-1,0,1],[-1,1,0],[0,-1,1],[0,1,-1],[1,-1,0],[1,0,-1]], comparison: "unordered-nested" },
    { arguments: [[1,2,3,4,5]], expectedValue: [[1,2,3,4,5],[1,2,3,5,4],[1,2,4,3,5],[1,2,4,5,3],[1,2,5,3,4],[1,2,5,4,3],[1,3,2,4,5],[1,3,2,5,4],[1,3,4,2,5],[1,3,4,5,2],[1,3,5,2,4],[1,3,5,4,2],[1,4,2,3,5],[1,4,2,5,3],[1,4,3,2,5],[1,4,3,5,2],[1,4,5,2,3],[1,4,5,3,2],[1,5,2,3,4],[1,5,2,4,3],[1,5,3,2,4],[1,5,3,4,2],[1,5,4,2,3],[1,5,4,3,2],[2,1,3,4,5],[2,1,3,5,4],[2,1,4,3,5],[2,1,4,5,3],[2,1,5,3,4],[2,1,5,4,3],[2,3,1,4,5],[2,3,1,5,4],[2,3,4,1,5],[2,3,4,5,1],[2,3,5,1,4],[2,3,5,4,1],[2,4,1,3,5],[2,4,1,5,3],[2,4,3,1,5],[2,4,3,5,1],[2,4,5,1,3],[2,4,5,3,1],[2,5,1,3,4],[2,5,1,4,3],[2,5,3,1,4],[2,5,3,4,1],[2,5,4,1,3],[2,5,4,3,1],[3,1,2,4,5],[3,1,2,5,4],[3,1,4,2,5],[3,1,4,5,2],[3,1,5,2,4],[3,1,5,4,2],[3,2,1,4,5],[3,2,1,5,4],[3,2,4,1,5],[3,2,4,5,1],[3,2,5,1,4],[3,2,5,4,1],[3,4,1,2,5],[3,4,1,5,2],[3,4,2,1,5],[3,4,2,5,1],[3,4,5,1,2],[3,4,5,2,1],[3,5,1,2,4],[3,5,1,4,2],[3,5,2,1,4],[3,5,2,4,1],[3,5,4,1,2],[3,5,4,2,1],[4,1,2,3,5],[4,1,2,5,3],[4,1,3,2,5],[4,1,3,5,2],[4,1,5,2,3],[4,1,5,3,2],[4,2,1,3,5],[4,2,1,5,3],[4,2,3,1,5],[4,2,3,5,1],[4,2,5,1,3],[4,2,5,3,1],[4,3,1,2,5],[4,3,1,5,2],[4,3,2,1,5],[4,3,2,5,1],[4,3,5,1,2],[4,3,5,2,1],[4,5,1,2,3],[4,5,1,3,2],[4,5,2,1,3],[4,5,2,3,1],[4,5,3,1,2],[4,5,3,2,1],[5,1,2,3,4],[5,1,2,4,3],[5,1,3,2,4],[5,1,3,4,2],[5,1,4,2,3],[5,1,4,3,2],[5,2,1,3,4],[5,2,1,4,3],[5,2,3,1,4],[5,2,3,4,1],[5,2,4,1,3],[5,2,4,3,1],[5,3,1,2,4],[5,3,1,4,2],[5,3,2,1,4],[5,3,2,4,1],[5,3,4,1,2],[5,3,4,2,1],[5,4,1,2,3],[5,4,1,3,2],[5,4,2,1,3],[5,4,2,3,1],[5,4,3,1,2],[5,4,3,2,1]], comparison: "unordered-nested" }
  ],
  "word-search-ii": [
    { arguments: [[["o","a","a","n"],["e","t","a","e"],["i","h","k","r"],["i","f","l","v"]],["oath","pea","eat","rain"]], expectedValue: ["eat","oath"], comparison: "unordered" },
    { arguments: [[["a","b"],["c","d"]],["abcb"]], expectedValue: [] },
    // Hidden from here on — generated from the verified reference.
    { arguments: [[["a"]],["a"]], expectedValue: ["a"], comparison: "unordered" },
    { arguments: [[["a"]],["b"]], expectedValue: [], comparison: "unordered" },
    { arguments: [[["a","b"]],["ab","ba"]], expectedValue: ["ab","ba"], comparison: "unordered" },
    { arguments: [[["a","a"]],["aa","aaa"]], expectedValue: ["aa"], comparison: "unordered" },
    { arguments: [[["o","a"],["e","t"]],["oat","oa","ate","zz"]], expectedValue: ["oat","oa","ate"], comparison: "unordered" },
    { arguments: [[["a","b","c"],["d","e","f"],["g","h","i"]],["abc","adg","aei","cfi","xyz","beh"]], expectedValue: ["abc","adg","cfi","beh"], comparison: "unordered" }
  ],
  "n-queens": [
    { arguments: [4], expectedValue: [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]], comparison: "unordered-nested" },
    { arguments: [1], expectedValue: [["Q"]] },
    // Hidden from here on — generated from the verified reference.
    { arguments: [2], expectedValue: [], comparison: "unordered-nested" },
    { arguments: [3], expectedValue: [], comparison: "unordered-nested" },
    { arguments: [5], expectedValue: [["Q....","..Q..","....Q",".Q...","...Q."],["Q....","...Q.",".Q...","....Q","..Q.."],[".Q...","...Q.","Q....","..Q..","....Q"],[".Q...","....Q","..Q..","Q....","...Q."],["..Q..","Q....","...Q.",".Q...","....Q"],["..Q..","....Q",".Q...","...Q.","Q...."],["...Q.","Q....","..Q..","....Q",".Q..."],["...Q.",".Q...","....Q","..Q..","Q...."],["....Q",".Q...","...Q.","Q....","..Q.."],["....Q","..Q..","Q....","...Q.",".Q..."]], comparison: "unordered-nested" },
    { arguments: [6], expectedValue: [[".Q....","...Q..",".....Q","Q.....","..Q...","....Q."],["..Q...",".....Q",".Q....","....Q.","Q.....","...Q.."],["...Q..","Q.....","....Q.",".Q....",".....Q","..Q..."],["....Q.","..Q...","Q.....",".....Q","...Q..",".Q...."]], comparison: "unordered-nested" },
    { arguments: [7], expectedValue: [["Q......","..Q....","....Q..","......Q",".Q.....","...Q...",".....Q."],["Q......","...Q...","......Q","..Q....",".....Q.",".Q.....","....Q.."],["Q......","....Q..",".Q.....",".....Q.","..Q....","......Q","...Q..."],["Q......",".....Q.","...Q...",".Q.....","......Q","....Q..","..Q...."],[".Q.....","...Q...","Q......","......Q","....Q..","..Q....",".....Q."],[".Q.....","...Q...",".....Q.","Q......","..Q....","....Q..","......Q"],[".Q.....","....Q..","Q......","...Q...","......Q","..Q....",".....Q."],[".Q.....","....Q..","..Q....","Q......","......Q","...Q...",".....Q."],[".Q.....","....Q..","......Q","...Q...","Q......","..Q....",".....Q."],[".Q.....",".....Q.","..Q....","......Q","...Q...","Q......","....Q.."],[".Q.....","......Q","....Q..","..Q....","Q......",".....Q.","...Q..."],["..Q....","Q......",".....Q.",".Q.....","....Q..","......Q","...Q..."],["..Q....","Q......",".....Q.","...Q...",".Q.....","......Q","....Q.."],["..Q....","....Q..","......Q",".Q.....","...Q...",".....Q.","Q......"],["..Q....",".....Q.",".Q.....","....Q..","Q......","...Q...","......Q"],["..Q....","......Q",".Q.....","...Q...",".....Q.","Q......","....Q.."],["..Q....","......Q","...Q...","Q......","....Q..",".Q.....",".....Q."],["...Q...","Q......","..Q....",".....Q.",".Q.....","......Q","....Q.."],["...Q...","Q......","....Q..",".Q.....",".....Q.","..Q....","......Q"],["...Q...",".Q.....","......Q","....Q..","..Q....","Q......",".....Q."],["...Q...",".....Q.","Q......","..Q....","....Q..","......Q",".Q....."],["...Q...","......Q","..Q....",".....Q.",".Q.....","....Q..","Q......"],["...Q...","......Q","....Q..",".Q.....",".....Q.","Q......","..Q...."],["....Q..","Q......","...Q...","......Q","..Q....",".....Q.",".Q....."],["....Q..","Q......",".....Q.","...Q...",".Q.....","......Q","..Q...."],["....Q..",".Q.....",".....Q.","..Q....","......Q","...Q...","Q......"],["....Q..","..Q....","Q......",".....Q.","...Q...",".Q.....","......Q"],["....Q..","......Q",".Q.....","...Q...",".....Q.","Q......","..Q...."],["....Q..","......Q",".Q.....",".....Q.","..Q....","Q......","...Q..."],[".....Q.","Q......","..Q....","....Q..","......Q",".Q.....","...Q..."],[".....Q.",".Q.....","....Q..","Q......","...Q...","......Q","..Q...."],[".....Q.","..Q....","Q......","...Q...","......Q","....Q..",".Q....."],[".....Q.","..Q....","....Q..","......Q","Q......","...Q...",".Q....."],[".....Q.","..Q....","......Q","...Q...","Q......","....Q..",".Q....."],[".....Q.","...Q...",".Q.....","......Q","....Q..","..Q....","Q......"],[".....Q.","...Q...","......Q","Q......","..Q....","....Q..",".Q....."],["......Q",".Q.....","...Q...",".....Q.","Q......","..Q....","....Q.."],["......Q","..Q....",".....Q.",".Q.....","....Q..","Q......","...Q..."],["......Q","...Q...","Q......","....Q..",".Q.....",".....Q.","..Q...."],["......Q","....Q..","..Q....","Q......",".....Q.","...Q...",".Q....."]], comparison: "unordered-nested" }
  ]
};

export function structuredCasesForBatch9(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch9[slug];
  // A set is valid if it covers at least the examples; extra cases are hidden.
  return cases && cases.length >= examples.length ? cases : null;
}
