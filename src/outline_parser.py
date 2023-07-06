def outline_parser(str):
    header = str.splitlines()
    section = ""
    count=0
    for i in header:
        if "H2" in i:
            section+=i+'\n'
            count+=1
    return (header, count)

