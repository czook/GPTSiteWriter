#bring in deps
import os
import streamlit as st
from langchain.llms import OpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, SimpleSequentialChain
from header_parser import GoogleSearch
import time
from outline_parser import *
apikey = os.environ['OPENAI_API_KEY']

st.title("✍️  Blog Writer")
keyword = st.text_input('Add your keywords here')

search=GoogleSearch.GoogleSearch(keyword)
time.sleep(2)

#llms
llm = OpenAI(temperature=0.3)
prompt_template = PromptTemplate(
    input_variables = ['outline'],
    template = "Write this essay as if you are a Software Engineer. USE MARKDOWN FORMATTING\n" +\
            "USE THE TITLES FROM THE HEADER OUTLINE\n" +\
            'Outline : {outline}\n' +\
            'Write this section of the article'
)

outline_template = PromptTemplate(
    input_variables = ['keyword', 'h1', 'h2'],
    template = "Write an outline for the keyword {keyword}\n" +\
    "Use these header lists from similar articiles to help write the outline\n" +\
    'H1 headers:{h1}\n' +\
    'H2 headers:{h2}\n' +\
    'The output should be in the format below\n' +\
    'H1:\n  H2:\n       H3:\n       H3:\n   H2:\n       H3:\n       H3:\n Continue format until the outline is done\n' +\
    'Create H3 headers that are relavent to the H2 headers above it. Make sure each header is on a newline'
)
blog_chain = LLMChain(
    llm = llm,
    prompt = prompt_template
)

outline_chain = LLMChain(
    llm=llm,
    prompt = outline_template
)
h1="".join(search["h1"])
h2="".join(search["h2"])

if keyword:
    outline = outline_chain.run(keyword=keyword,h1=h1,h2=h2)
    result = outline_parser(outline)
    print(result)
    essay = ""
    for i in result:
        essay += blog_chain.run(outline=i)
    print(essay)
    st.write(essay)
