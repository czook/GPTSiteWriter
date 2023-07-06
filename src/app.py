#bring in deps
import os
import streamlit as st
from langchain.llms import OpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from outline_parser import *
apikey = os.environ['OPENAI_API_KEY']

st.title("✍️  Blog Writer")
keyword = st.text_input('Add your keywords here')

# search=GoogleSearch.GoogleSearch(keyword)
# time.sleep(2)

#llms
llm = OpenAI(temperature=0)
prompt_template = PromptTemplate(
    input_variables = ['outline'],
    template = "Write this essay as if you are a Software Engineer. USE MARKDOWN FORMATTING\n" +\
            "USE THE TITLES FROM THE HEADER OUTLINE\n" +\
            'Outline : {outline}\n'
)

outline_template = PromptTemplate(
    input_variables = ['keyword'],
    template = 'Write a creative outline on {keyword} (with subtopics phrased casually and concisely)\n' +\
    "Start Each H2 heading for the outline start with 'H2:' then header, then newline"
    # 'H1 headers:{h1}\n' +\
    # 'H2 headers:{h2}\n'
)
blog_chain = LLMChain(
    llm = llm,
    prompt = prompt_template
)

outline_chain = LLMChain(
    llm=llm,
    prompt = outline_template
)
# h1="".join(search["h1"])
# h2="".join(search["h2"])

if keyword:
    outline = outline_chain.run(keyword=keyword)
    #result = outline_parser(outline)
    st.write(outline)
    print(outline_parser(outline))
    # essay = ""
    # essay = blog_chain.run(outline=outline)
    # st.write(essay)
