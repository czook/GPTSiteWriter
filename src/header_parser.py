from urllib.request import Request, urlopen
from html.parser import HTMLParser
import googlesearch
import time

#parses HMTL for H1,H2,H3 headers
class MyHTMLParser(HTMLParser):
    current_header = ""
    header_dict = {
        "h1" : [],
        "h2" : []
    }
    def handle_starttag(self, tag, attrs):
        if (tag[0:2] == "h1" or tag[0:2] == "h2"):
            self.current_header = tag[0:2]

    def handle_endtag(self, tag):
        if (tag[0:2] == "h1" or tag[0:2] == "h2"):
            self.current_header = ""

    def handle_data(self, data):
            if (self.current_header and data[0].isalnum()):
                self.header_dict[self.current_header].append(data)

    def get_header_dict(self):
        return self.header_dict

#calls the header parser
class HeaderParser:
    @staticmethod
    def header_parser(url):
        try:
            
            fp = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}))
            mybytes = fp.read()
            
            mystr = mybytes.decode("utf8")
            fp.close()

            parser = MyHTMLParser()
            parser.feed(mystr)
            
        
            temp = parser.get_header_dict()
            parser.close()
            return temp
        except Exception as ex:
            print("error-parser: ", url, "\nException: ", ex)
    
    @staticmethod    
    def url_checker(url):
        try:
            fp = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}))
            fp.close()
            return ""
        except:
            return "error-checker"


#runs the google searches
class GoogleSearch:
    @staticmethod
    def GoogleSearch(query):
        combined_headers = {
                "h1" : [],
                "h2" : []
        }
        url=[]
        for j in googlesearch.search(query, num=5, stop=5, user_agent=googlesearch.get_random_user_agent()):
            if (HeaderParser.url_checker(j) != "error"):
                url.append(j)

        for i in url:
            if (HeaderParser.url_checker(i) != "error-checker"):
                dict = HeaderParser.header_parser(i)
                combined_headers["h1"].extend(dict["h1"])
                combined_headers["h2"].extend(dict["h2"])

        return combined_headers

