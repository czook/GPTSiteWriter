from bs4 import BeautifulSoup
from collections import Counter
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.util import ngrams
import time
import googlesearch
import requests

#def get_most_common_ngrams(html, n_range=(1, 2), top_n=10):
def get_all_ngrams(html):
    soup = BeautifulSoup(html, 'html.parser')

    # Get the visible text
    text = soup.get_text()

    # headers = ['h1', 'h2', 'h3']
    # header_data = {}
    # for header in headers:
    #     header_data[header] = [element.text for element in soup.find_all(header)]
    # print(header_data)
    # Tokenize the text, make everything lower case, and remove punctuation and stopwords
    words = word_tokenize(text)
    words = [word.lower() for word in words if word.isalpha()]
    words = [word for word in words if word not in stopwords.words('english')]

    all_ngrams = []

    # Generate n-grams for n in range 1 to 3
    for n in range(1, 4):
        if n == 1:
            all_ngrams.extend(words)
        else:
            n_grams = ngrams(words, n)
            all_ngrams.extend(n_grams)

    # Count the occurrences of each n-gram
    counter = Counter(all_ngrams)
    # Filter the Counter
    filtered_ngrams = Counter({k: v for k, v in counter.items() if v >= 3}).most_common()
    return filtered_ngrams # header_data

def search_keyword(keyword):
    search=googlesearch.search(keyword, num=10, stop=10, user_agent=googlesearch.get_random_user_agent())
    header_data = {}
    return_ngrams = {}
    for i in search:
        print(i)
        response = requests.get(i)
        #tempgrams, headers = get_all_ngrams(response.text)
        tempgrams = get_all_ngrams(response.text)
        # if not header_data:
        #     header_data.update(headers)
        if not return_ngrams:
            return_ngrams.update(tempgrams)
    return return_ngrams, header_data

ngram_data, header_data = search_keyword("what is a computer science students average day")
# Open a file in write mode
with open('ngrams.txt', 'w') as f:
    # Write some text to the file
    f.write(str(ngram_data))
# with open('headers.txt', 'w') as f:
#     # Write some text to the file
#     f.write(str(header_data))
