def outline_parser(str):
    header = str.splitlines() 
    index = 0
    sections = []
    section = ""
    for x, i in enumerate(header):
        if "H1" in i:
            title = i.split(':')[1]
        elif "H2" in i:
            if index is not None:
                sections.append(section)
                section = ""
            index = x     
        section += i
    return sections
